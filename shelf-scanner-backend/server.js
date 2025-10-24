// server.js
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios'); 
const fs = require('fs'); 

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json()); 

// --- Veritabanı Bağlantı Kurulumu ---
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost', 
  database: process.env.DB_DATABASE || 'shelf_scanner',
  password: process.env.DB_PASSWORD || 'admin',
  port: parseInt(process.env.DB_PORT || '5432'),
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


const storage = multer.memoryStorage();
const upload = multer({ storage: storage });



app.get('/', (req, res) => {
    res.send('Merhaba! Bu Shelf Scanner Backend Sunucusu!');
});

app.post('/api/preferences', async (req, res) => {
  // 1. React'ten sadece ham metni al
  const { category } = req.body; 
  if (!category) {
    return res.status(400).json({ message: 'Kategori boş olamaz.' });
  }

  // 2. API anahtarımızı al
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'Sunucu yapılandırma hatası: API anahtarı eksik.' });
  }

  let client;

  try {
    console.log(`Duygu analizi için YZ'ya soruluyor: "${category}"`);
    const sentimentPrompt = `
      Kullanıcı bir okuma tercihi girdi. Lütfen bu cümlenin genel duygusunu analiz et.
      Cümle: "${category}"
      
      Cevabın SADECE şu iki kelimeden biri olmalı:

      1. POZITIF: 
         - Eğer "seviyorum", "bayılırım" gibi net olumlu bir anlam varsa.
         - VEYA "Tarih", "Fantastik", "Bilim Kurgu" gibi nötr bir kategori adı girilmişse (bunları da olumlu kabul et).

      2. NEGATIF: 
         - Eğer "sevmiyorum", "nefret ederim", "istemiyorum" gibi bir olumsuz anlam varsa.
    `;

    const payload = {
      model: "gpt-4o",
      messages: [ { role: "user", content: sentimentPrompt } ],
      max_tokens: 10,
      temperature: 0 
    };

    const aiResponse = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });

    const sentiment = aiResponse.data.choices[0].message.content.toUpperCase().trim();
    console.log(`YZ Cevabı: ${sentiment}`);
    const likes = (sentiment === 'POZITIF');

    //  Veritabanına kaydet
    client = await pool.connect();
    const queryText = 'INSERT INTO preferences (category, likes) VALUES ($1, $2) RETURNING *';
    const queryValues = [category, likes]; 
    
    const result = await client.query(queryText, queryValues);
    client.release();
    
    res.status(201).json(result.rows[0]); 

  } catch (error) {
    if (client) client.release();
    console.error('Tercih eklenirken (YZ analizi) hata:', error.response ? error.response.data : error.message);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// (READ) Tercihleri listeleme
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

// (DELETE) Bir tercihi ID'sine göre silme
app.delete('/api/preferences/:id', async (req, res) => {
    const { id } = req.params; 
    try {
        const client = await pool.connect();
        const queryText = 'DELETE FROM preferences WHERE id = $1 RETURNING *';
        const result = await client.query(queryText, [id]);
        client.release();
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Silinecek tercih bulunamadı.' });
        }
        
        res.json({ message: 'Tercih başarıyla silindi.', deleted: result.rows[0] }); 
    } catch (error) {
        console.error('Tercih silinirken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası', error: error.message });
    }
});

// (UPLOAD) Fotoğraf yükleme ve YZ analizi
app.post('/api/upload', upload.single('bookImage'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Dosya yüklenmedi.' });
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('OPENAI_API_KEY .env dosyasında bulunamadı.');
        return res.status(500).json({ message: 'Sunucu yapılandırma hatası: API anahtarı eksik.' });
    }

    let client; 
    
    try {
        // --- ADIM 1: FOTOĞRAFTAN KİTAPLARI ÇIKAR ---
        console.log('Adım 1: Fotoğraf analiz ediliyor (Vision API)...');
        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        const visionPayload = {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Bu, bir kitap rafı fotoğrafıdır. Lütfen fotoğrafta okunabilen TÜM kitapların başlıklarını ve (eğer görünüyorsa) yazarlarını AÇIK ve NET bir şekilde, madde madde listele. Sadece listeyi ver. Başka hiçbir yorum, giriş veya sonuç cümlesi ekleme." },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                    ]
                }
            ],
            max_tokens: 1000
        };

        const visionResponse = await axios.post('https://api.openai.com/v1/chat/completions', visionPayload, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        const bookListText = visionResponse.data.choices[0].message.content;
        console.log('Adım 1 Başarılı. Tanınan Kitaplar:', bookListText);

        // ---  VERİTABANINDAN TERCİHLERİ ÇEK ---
        console.log('Adım 2: Veritabanından tercihler çekiliyor...');
        client = await pool.connect();
        const prefsResult = await client.query('SELECT * FROM preferences'); 
        client.release(); 

        const userPreferencesText = prefsResult.rows.map(p => {
            return `${p.category} (${p.likes ? 'Seviyorum' : 'Sevmiyorum'})`;
        }).join(', ');
        console.log('Adım 2 Başarılı. Kullanıcı Tercihleri:', userPreferencesText);

        // ---  KİŞİSELLEŞTİRİLMİŞ ÖNERİ İÇİN YZ'YA TEKRAR SOR ---
        console.log('Adım 3: Kişiselleştirilmiş öneri oluşturuluyor (Text API)...');
        
        const recommendationPrompt = `
      Sen bir kitap kurdu ve kişisel okuma asistanısın. Görevin, bir kullanıcının kitaplığındaki kitapları analiz etmek ve tercihlerine göre kişiselleştirilmiş bir öneri sunmaktır.

      KULLANICI BİLGİLERİ:
      - Kullanıcının Tercihleri: ${userPreferencesText || 'Henüz tercih belirtilmemiş.'}

      TARANAN KİTAPLAR:
      - Raftaki Kitapların Listesi: ${bookListText}

      GÖREVİN:
      Lütfen cevabını AYNEN aşağıdakİ iki bölüm formatında ver:

      **Rafta Gördüklerim:**
      [Buraya, "TARANAN KİTAPLAR" bölümünde sana verdiğim listeyi olduğu gibi yaz.]

      **Sana Özel Önerim:**
      [Buraya, "KULLANICI BİLGİLERİ" bölümündeki tercihleri analiz et. Bu tercihlere ve "TARANAN KİTAPLAR" listesine dayanarak, raftaki kitaplardan BİR tanesini neden okuması gerektiğini arkadaşça bir dille açıkla. Eğer tercihlerle HİÇBİRİ uyuşmuyorsa, 'Tercihlerinle tam uyuşan bir kitap bulamasam da...' diye başlayan bir alternatif öneri sun.]
    `;
        
        const recommendationPayload = {
            model: "gpt-4o",
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

        // --- REACT'E ÖNERİ METNİNİ GÖNDER ---
        res.json({ 
            message: 'Kişiselleştirilmiş öneriler hazır!',
            books: recommendationText
        });

    } catch (error) {
        if (client) client.release();
        console.error('API Zinciri Hatası:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Yapay zeka analizi sırasında hata oluştu.', details: error.message });
    }
});
 
// --- Sunucuyu Başlatma ---
app.listen(PORT, () => {
    console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor...`);
    initializeDatabase();
});