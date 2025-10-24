// src/App.jsx

import React, { useState, useEffect } from 'react';
import './App.css'; 

function App() {
  
  // --- STATE (Durum) Değişkenlerimiz ---
  const [mesaj, setMesaj] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [preferences, setPreferences] = useState([]);
  const [newPreference, setNewPreference] = useState('');
  const [bookList, setBookList] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fetchPreferences = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/preferences');
      const data = await response.json();
      setPreferences(data);
    } catch (error) {
      console.error('Tercihler yüklenirken hata:', error);
    }
  };

  const handleDeletePreference = async (id) => {
 
    if (!window.confirm('Bu tercihi silmek istediğinizden emin misiniz?')) {
      return; 
    }

    try {
      const response = await fetch(`http://localhost:3001/api/preferences/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setMesaj(data.message); 
        fetchPreferences(); 
      } else {
        setMesaj(`Hata: ${data.message}`);
      }
    } catch (error) {
      console.error('Tercih silinirken hata:', error);
      setMesaj('Tercih silinemedi.');
    }
  };
  useEffect(() => {
    fetchPreferences();
  }, []);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setMesaj(''); 
    setBookList(''); 
  };

  const handleScanClick = async () => {
    if (!selectedFile) {
      alert('Lütfen önce bir fotoğraf seçin!');
      return;
    }

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
        setMesaj(data.message); 
        setBookList(data.books); 
      } else {

        setMesaj(`Hata: ${data.message}`);
      }
      
    } catch (error) {
      console.error('Dosya yüklenirken hata oluştu:', error);
      setMesaj('Bağlantı hatası: Fotoğraf yüklenemedi.');
    } finally {

      setIsLoading(false); 
    }
  };
  
  const handleSavePreference = async () => {

    if (!newPreference) {
      alert('Lütfen bir kategori adı girin (örn: Fantastik)');
      return;
    }
    try {
      const response = await fetch('http://localhost:3001/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 
        },
        
        body: JSON.stringify({ category: newPreference }), 
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

  return (
    <div className="container">
      {}
      <h1>Shelf Scanner <span>Projesi</span></h1>

      {/* 3. BÖLÜM: Sunucu Mesaj Alanı (YENİ VE DOĞRU YERİ BURASI) */}
      {/* Kullanıcının aksiyon sonuçlarını hemen görmesi için yukarı taşıdık */}
      {mesaj && (
        <div className="response-area">
          <h2>Sunucu Yanıtı:</h2>
          <p>{mesaj}</p>
        </div>
      )}
      
      {/* ANA YERLEŞİM DİV'İ BAŞLANGIÇ */}
      {/* Bu div, iki ana bölümü (tercihler ve tarama) yanyana tutacak */}
      {/* Mesaj kutusundan sonra başlar */}
      <div className="main-layout">
      
        {/* 1. BÖLÜM: Tercih Yönetimi (Sol Sütun) */}
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
                    {}
                    <span>
                      {pref.category} (Likes: {pref.likes ? 'Evet' : 'Hayır'})
                    </span>
                    
                    {}
                    <button 
                      onClick={() => handleDeletePreference(pref.id)} 
                      className="delete-btn"
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {}
        <div className="section">
          <h2>Fotoğraf Tara</h2>
          <p>Lütfen taranacak kitap rafının fotoğrafını seçin.</p>
          <input 
            type="file" 
            accept="image/*"
            onChange={handleFileChange}
            className="file-input"
          />
          {}
          <button onClick={handleScanClick} disabled={!selectedFile || isLoading}>
            {isLoading ? 'Analiz Ediliyor...' : 'Fotoğrafı Tara'}
          </button>
          
          {/* YZ'dan gelen kitap listesini gösterme alanı */}
          {bookList && (
            <div className="book-list-container">
              <h3>Tanınan Kitaplar:</h3>
              {/* '<pre>' etiketi, YZ'dan gelen metindeki 
                  boşlukları ve satır atlamalarını korur */}
              <pre className="book-list-pre">{bookList}</pre>
            </div>
          )}
        </div>
        
      </div>
      {}

      {}

    </div>
  );
}
export default App;