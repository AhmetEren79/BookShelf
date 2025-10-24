 BookShelf Projesi (Shelf Scanner)

Bu proje, bir kitaplık fotoğrafını analiz edip kullanıcının tercihlerine göre kitap önerileri sunan bir web uygulamasıdır.

 Kurulum ve Çalıştırma

1.  Docker Desktop'ı Kurun: Henüz kurulu değilse [Docker Desktop](https://www.docker.com/products/docker-desktop/) adresinden indirip kurun ve çalıştırın.
2.  Projeyi Klonlayın:
    ```bash
    git clone [https://github.com/AhmetEren79/BookShelf.git](https://github.com/AhmetEren79/BookShelf.git)
    cd BookShelf
    ```
3.  API Anahtarını Ayarlayın: Projenin ana dizininde (`BookShelf` klasöründe) `.env` adında bir dosya oluşturun. İçine OpenAI API anahtarınızı aşağıdaki formatta ekleyin:
    ```
    OPENAI_API_KEY=sk-YOUR_OPENAI_API_KEY_HERE
    ```
4.  Uygulamayı Başlatın: Aynı ana dizindeyken terminalde şu komutu çalıştırın:
    ```
    docker-compose up --build
    ```
    (İlk çalıştırmada `--build` gereklidir. Sonraki çalıştırmalarda sadece `docker-compose up` yeterlidir.)
5.  Erişim:
    * Frontend (Arayüz): Tarayıcınızda `http://localhost:5173` adresine gidin.
    * Backend API (Doğrudan Erişim): `http://localhost:3001`

6. Durdurma: Uygulamayı durdurmak için `docker-compose up` komutunu çalıştırdığınız terminalde `Ctrl + C` tuşlarına basın. Container'ları tamamen kaldırmak için `docker-compose down` komutunu kullanabilirsiniz.
