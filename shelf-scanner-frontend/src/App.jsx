// src/App.jsx

import React, { useState, useEffect } from 'react';
import './App.css'; 

function App() {
  
  // --- STATE (Durum) Değişkenlerimiz ---
  const [mesaj, setMesaj] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [preferences, setPreferences] = useState([]);
  const [newPreference, setNewPreference] = useState('');
  
  // YENİ: YZ'dan gelen kitap listesi metnini saklamak için
  const [bookList, setBookList] = useState('');
  
  // YENİ: Yükleme (Loading) durumunu yönetmek için
  const [isLoading, setIsLoading] = useState(false);

  // --- FONKSİYONLAR ---

  const fetchPreferences = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/preferences');
      const data = await response.json();
      setPreferences(data);
    } catch (error) {
      console.error('Tercihler yüklenirken hata:', error);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setMesaj(''); // Eski mesajları temizle
    setBookList(''); // Eski kitap listesini temizle
  };

  // 'Kitapları Tara' butonu fonksiyonunu GÜNCELLE
  const handleScanClick = async () => {
    if (!selectedFile) {
      alert('Lütfen önce bir fotoğraf seçin!');
      return;
    }
    
    // Yükleme durumunu başlat
    setIsLoading(true);
    setMesaj('Fotoğraf analiz ediliyor... Bu 30 saniye sürebilir.'); // Kullanıcıyı bilgilendir
    setBookList('');
    
    const formData = new FormData();
    formData.append('bookImage', selectedFile); 

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();

      if (response.ok) {
        // Başarılı ise...
        setMesaj(data.message); // "Kitaplar başarıyla tanındı!"
        setBookList(data.books); // Gelen kitap listesi metni
      } else {
        // Hata varsa (örn: 500 sunucu hatası)
        setMesaj(`Hata: ${data.message}`);
      }
      
    } catch (error) {
      console.error('Dosya yüklenirken hata oluştu:', error);
      setMesaj('Bağlantı hatası: Fotoğraf yüklenemedi.');
    } finally {
      // Ne olursa olsun yükleme durumunu bitir
      setIsLoading(false); 
    }
  };
  
  const handleSavePreference = async () => {
    // ... (Bu fonksiyon aynı, değişiklik yok) ...
    if (!newPreference) {
      alert('Lütfen bir kategori adı girin (örn: Fantastik)');
      return;
    }
    try {
      const response = await fetch('http://localhost:3001/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newPreference, likes: true }),
      });
      if (response.ok) {
        setNewPreference('');
        fetchPreferences();
        setMesaj(`'${newPreference}' tercihi eklendi.`);
      } else {
        const data = await response.json();
        setMesaj(`Hata: ${data.message}`);
      }
    } catch (error) {
      console.error('Tercih kaydedilirken hata:', error);
      setMesaj('Tercih kaydedilemedi.');
    }
  };

  // --- HTML (JSX) Alanı ---
  return (
    <div className="container">
      <h1>Shelf Scanner Projesi</h1>
      
      {/* 1. BÖLÜM: Tercih Yönetimi (Aynı) */}
      <div className="section">
        <h2>Okuma Tercihlerim</h2>
        <div className="preference-form">
          <input 
            type="text"
            value={newPreference}
            onChange={(e) => setNewPreference(e.target.value)}
            placeholder="örn: Bilim Kurgu, Tarih..."
            className="text-input"
          />
          <button onClick={handleSavePreference}>Tercih Ekle</button>
        </div>
        <div className="preference-list">
          <h3>Kayıtlı Tercihler:</h3>
          {preferences.length === 0 ? (
            <p>Henüz kayıtlı tercih yok.</p>
          ) : (
            <ul>
              {preferences.map((pref) => (
                <li key={pref.id}>
                  {pref.category} (Likes: {pref.likes ? 'Evet' : 'Hayır'})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* 2. BÖLÜM: Fotoğraf Tarama (Güncellendi) */}
      <div className="section">
        <h2>Fotoğraf Tara</h2>
        <p>Lütfen taranacak kitap rafının fotoğrafını seçin.</p>
        <input 
          type="file" 
          accept="image/*"
          onChange={handleFileChange}
          className="file-input"
        />
        {/* Butonu, yükleme (isLoading) sırasında pasif yap */}
        <button onClick={handleScanClick} disabled={!selectedFile || isLoading}>
          {isLoading ? 'Analiz Ediliyor...' : 'Fotoğrafı Tara'}
        </button>
        
        {/* YENİ: Kitap listesini gösterme alanı */}
        {bookList && (
          <div className="book-list-container">
            <h3>Tanınan Kitaplar:</h3>
            {/* '<pre>' etiketi, YZ'dan gelen metindeki 
                boşlukları ve satır atlamalarını korur */}
            <pre className="book-list-pre">{bookList}</pre>
          </div>
        )}
      </div>

      {/* 3. BÖLÜM: Sunucu Mesaj Alanı (Aynı) */}
      {mesaj && (
        <div className="response-area">
          <h2>Sunucu Yanıtı:</h2>
          <p>{mesaj}</p>
        </div>
      )}
    </div>
  );
}

export default App;