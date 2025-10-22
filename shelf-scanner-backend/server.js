// server.js

// 1. dotenv'i en üste dahil et (çok önemli)
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios'); // <-- 1. axios'u dahil et
const fs = require('fs'); // <-- 1. Dosya okumak/silmek için 'fs' modülünü dahil et

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json()); // JSON body'lerini parse etmek için

// --- Veritabanı Bağlantı Kurulumu ---
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'shelf_scanner',
  password: 'admin',
  port: 5432,
});

async function initializeDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('PostgreSQL veritabanına başarıyla bağlanıldı!');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS preferences (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        likes BOOLEAN NOT NULL DEFAULT true
      );
    `;
    await client.query(createTableQuery);
    console.log("Tablo başarıyla kontrol edildi/oluşturuldu: 'preferences'");
  } catch (error) {
    console.error('Veritabanı başlatma hatası:', error.message);
  } finally {
    if (client) client.release();
  }
}

// --- Multer Kurulumu ---
// 2. Multer'ı dosyayı diske değil, 'hafızaya' (memory) alacak şekilde değiştiriyoruz.
// Çünkü dosyayı sadece API'a gönderip sileceğiz.
const storage = multer.memoryStorage(); // <-- Diske kaydetmek yerine hafızayı kullan
const upload = multer({ storage: storage });

// --- API Uç Noktaları (Endpoints) ---

// ... (Diğer endpoint'ler: / , /api/preferences (POST ve GET) aynı kalabilir) ...

app.get('/', (req, res) => {
  res.send('Merhaba! Bu Shelf Scanner Backend Sunucusu!');
});

app.post('/api/preferences', async (req, res) => {
  const { category, likes } = req.body; 
  if (!category) {
    return res.status(400).json({ message: 'Kategori boş olamaz.' });
  }
  try {
    const client = await pool.connect();
    const queryText = 'INSERT INTO preferences (category, likes) VALUES ($1, $2) RETURNING *';
    const queryValues = [category, likes !== undefined ? likes : true];
    const result = await client.query(queryText, queryValues);
    client.release();
    res.status(201).json(result.rows[0]); 
  } catch (error) {
    console.error('Tercih eklenirken hata:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

app.get('/api/preferences', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM preferences ORDER BY id DESC');
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error('Tercihler alınırken hata:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// server.js içindeki SADECE /api/upload endpoint'ini değiştir.
// Diğerleri (GET /, POST/GET /api/preferences, GET /api/db-test) aynı kalacak.

app.post('/api/upload', upload.single('bookImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Dosya yüklenmedi.' });
  }
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY .env dosyasında bulunamadı.');
    return res.status(500).json({ message: 'Sunucu yapılandırma hatası: API anahtarı eksik.' });
  }

  let client; // Veritabanı client'ını tanımla
  
  try {
    // --- ADIM 1: FOTOĞRAFTAN KİTAPLARI ÇIKAR (Mevcut kod) ---
    console.log('Adım 1: Fotoğraf analiz ediliyor (Vision API)...');
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const visionPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Bu fotoğraftaki tüm kitapların isimlerini ve yazarlarını listele. Sadece listeyi ver, yorum ekleme." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]
        }
      ],
      max_tokens: 1000
    };

// DOĞRU KOD
    const visionResponse = await axios.post('https://api.openai.com/v1/chat/completions', visionPayload, {      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });

    const bookListText = visionResponse.data.choices[0].message.content;
    console.log('Adım 1 Başarılı. Tanınan Kitaplar:', bookListText);

    // --- ADIM 2: VERİTABANINDAN TERCİHLERİ ÇEK (Yeni) ---
    console.log('Adım 2: Veritabanından tercihler çekiliyor...');
    client = await pool.connect();
    const prefsResult = await client.query('SELECT * FROM preferences WHERE likes = true');
    client.release(); // Bağlantıyı hemen bırak

    // Tercihleri "Fantastik, Tarih" gibi bir metne dönüştür
    const userPreferencesText = prefsResult.rows.map(p => p.category).join(', ');
    console.log('Adım 2 Başarılı. Kullanıcı Tercihleri:', userPreferencesText);

    // --- ADIM 3: KİŞİSELLEŞTİRİLMİŞ ÖNERİ İÇİN YZ'YA TEKRAR SOR (Yeni) ---
    console.log('Adım 3: Kişiselleştirilmiş öneri oluşturuluyor (Text API)...');
    
    // YZ'ya göndereceğimiz talimat (prompt)
    const recommendationPrompt = `
      Bir kitap rafı tarandı ve şu kitaplar bulundu:
      [KİTAP LİSTESİ]
      ${bookListText}
      [/KİTAP LİSTESİ]

      Benim okuma tercihlerim ise şunlar:
      [TERCİHLERİM]
      ${userPreferencesText || 'Henüz tercih belirtilmemiş.'}
      [/TERCİHLERİM]

      Lütfen bu bilgilere dayanarak, raftaki kitaplardan hangilerini sevebileceğimi bana kısa ve arkadaşça bir dille öner. 
      Eğer tercihlerimle eşleşen bir kitap yoksa, raftakilerden en popüler olanı veya ilginç olanı belirt.
      Sadece öneri metnini yaz, ekstra başlık veya giriş yapma.
    `;
    
    const recommendationPayload = {
      model: "gpt-4o", // Metin için de bu modeli kullanabiliriz
      messages: [
        { role: "system", content: "Sen bir kitap kurdu ve kişisel okuma asistanısın." },
        { role: "user", content: recommendationPrompt }
      ],
      max_tokens: 500
    };

    const recommendationResponse = await axios.post('https://api.openai.com/v1/chat/completions', recommendationPayload, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });

    const recommendationText = recommendationResponse.data.choices[0].message.content;
    console.log('Adım 3 Başarılı. Öneri Metni:', recommendationText);

    // --- ADIM 4: REACT'E ÖNERİ METNİNİ GÖNDER (Güncellendi) ---
    res.json({ 
      message: 'Kişiselleştirilmiş öneriler hazır!',
      books: recommendationText // React'e artık ham listeyi değil, bu öneri metnini gönderiyoruz
    });

  } catch (error) {
    if (client) client.release(); // Hata durumunda bağlantıyı bıraktığından emin ol
    console.error('API Zinciri Hatası:', error.response ? error.response.data : error.message);
    res.status(500).json({ message: 'Yapay zeka analizi sırasında hata oluştu.', details: error.message });
  }
});
  
// --- Sunucuyu Başlatma ---
app.listen(PORT, () => {
  console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor...`);
  initializeDatabase();
});