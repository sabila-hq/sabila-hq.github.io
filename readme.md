# 🌸 SABILA: Sistem Asisten Backend & Infrastruktur Lokal AI

[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-purple.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)]()

**SABILA** adalah lingkungan pengembangan web lokal pintar (*local web development environment*) yang dirancang khusus untuk membantu pemula, pelajar, dan developer membangun proyek web secara mudah, cepat, dan terotomatisasi menggunakan kecerdasan buatan (AI).

Dipersembahkan dengan asisten cerdas terintegrasi, **SABIL.AI**, yang membantu mengendalikan server, mendeteksi error konfigurasi, hingga mengotomatisasi alur kerja backend Anda secara langsung dari komputer lokal Anda.

---

## 🚀 Fitur Utama

- **SABIL.AI (Asisten Cerdas Lokal)**: Kelola server lokal, mulai/hentikan layanan, ubah port, periksa error log, hingga konsultasikan bug kodingan secara interaktif.
- **Service Dashboard Terpadu**: Kontrol layanan web server terpopuler (Nginx, Apache, PHP, MySQL, phpMyAdmin) secara modular, responsif, dan rapi dalam satu panel.
- **Local Domain & SSL Dashboard**: Buat vhost lokal dengan ekstensi domain khusus secara otomatis, lengkap dengan sertifikat SSL lokal.
- **Multi-Version Runtime (PHP & Node.js)**: Mendukung eksekusi environment dengan versi spesifik untuk setiap proyek yang berbeda, baik di Terminal, Nginx, maupun Cron.
- **Secret Manager (Security Shield)**: Simpan API Key penting (AWS, Stripe, dll) di penyimpanan persisten terenkripsi yang langsung disuntikkan (*injected*) ke dalam memori aplikasi dan terminal, tanpa membocorkannya ke file `.env` di disk.
- **Task & Cron Job Runner**: Kelola dan jadwalkan tugas (*background tasks*) lengkap dengan fitur pemantauan status (Sukses/Gagal) dan baca *output* eksekusi langsung dari *dashboard*.
- **Integrated Email Testing Server (Mail Catcher)**: Tangkap *email* percobaan yang dikirim oleh aplikasi lokal tanpa perlu layanan berbayar pihak ketiga, dan baca pesan langsung melalui *dashboard*.
- **Auto-Rename Document Root**: Dukungan mulus (*seamless*) untuk pergantian *Document Root* antara standar Laragon (`www`) dan standar XAMPP (`htdocs`).
- **Integrasi MCP (Model Context Protocol)**: Integrasikan Sabila dengan agen AI favorit Anda (seperti Claude Desktop) agar AI dapat membaca repositori lokal dan log server Anda dengan aman.

---

## 📁 Struktur Folder Sabila

Sabila menggunakan arsitektur portabel standar industri untuk memastikan kenyamanan dan keamanan eksekusi sistem:

```text
C:\sabila\
├── bin\             # Berisi biner server (nginx, php, apache, mysql, composer, dll)
├── data\            # Direktori penyimpanan data MySQL / MariaDB
├── etc\             # File konfigurasi sistem (SSL, Vhosts, php.ini)
└── www\             # Direktori utama proyek web Anda (document root)
```

> [!NOTE]  
> Menyimpan seluruh ekosistem Sabila di dalam folder `C:\sabila` menghindari batasan akses file Windows (UAC) serta menjaga sistem operasi Anda tetap bersih tanpa mengotori registry global.

---

## 🛠️ Alur Setup Awal (Setup Wizard)

Saat pertama kali dijalankan, Sabila akan memandu Anda melalui 5 tahapan konfigurasi dasar:

1. **Tahap 1: Validasi Sistem**: Otomatis mendeteksi instalasi Node.js dan NPM di perangkat Anda. Jika belum terinstal, Sabila menyediakan tautan unduhan installer resmi (.msi).
2. **Tahap 2: Lokasi Folder**: Menentukan folder utama tempat seluruh server akan dipasang (default: `C:\sabila`).
3. **Tahap 3: Download Komponen**: Menyediakan tautan unduhan langsung untuk biner esensial (Nginx, Apache, PHP, MySQL, phpMyAdmin, Notepad++, Git, dan Composer) yang akan diekstrak ke dalam folder `/bin`.
4. **Tahap 4: Preferensi**: Atur bahasa antarmuka (Bahasa Indonesia / English) dan tema visual (Dark Mode / Light Mode).
5. **Tahap 5: Selesai**: Sabila siap digunakan untuk memulai petualangan coding Anda!

---

## 🔒 Keamanan & Kebijakan Privasi (Disclaimer Resmi)

> [!IMPORTANT]  
> **HINDARI UNDUHAN DARI PIHAK KETIGA YANG TIDAK DIKENAL**  
> Proyek Sabila bersifat sumber terbuka (*open source*). Siapa pun dapat menyalin kode sumber ini dan membuat modifikasi. Untuk menghindari risiko infeksi malware, adware, atau virus, pastikan Anda **hanya** mengunduh file instalasi (`.exe`) dari saluran rilis resmi kami.

*   **Official Website**: [sabila-hq.github.io](https://sabila-hq.github.io/)
*   **Official Releases**: [GitHub Releases](https://github.com/sabila-hq/sabila-hq.github.io/releases)

Aplikasi Sabila memerlukan beberapa izin sistem lokal untuk berfungsi dengan benar:
- **Akses File**: Membaca/menulis konfigurasi server di folder `C:\sabila`.
- **Akses Jaringan**: Menjalankan port lokal (seperti Port 80, 443, 3306) untuk web server Anda.
- **Akses Shell**: Memulai atau menghentikan proses latar belakang (*background processes*) untuk layanan server lokal.

---

## 🎮 Mini Game: "Escape The Bug!"

<details>
<summary><b>Misi 1: Server Apache Anda tiba-tiba mati! Port 80 bentrok. Apa yang Anda lakukan?</b> <i>(Klik untuk menjawab)</i></summary>
<br>
<blockquote>
<details>
<summary>🔴 A. Banting laptop dan ganti profesi jadi peternak lele.</summary>
<br>
<i>Salah! Lele memang menggiurkan, tapi jangan menyerah dulu. Coba lagi!</i>
</details>

<details>
<summary>🟡 B. Buka Task Manager, cari proses yang nyangkut, matikan paksa, edit config manual, lalu restart.</summary>
<br>
<i>Bisa sih, tapi capek kan? Ada cara yang lebih "manusiawi". Coba lagi!</i>
</details>

<details>
<summary>🟢 C. Buka Sabila, biarkan sistem yang auto-kill port 80 dan menyelesaikan semuanya dalam 1 detik.</summary>
<br>
<b>🎉 TEPAT SEKALI!</b><br> 
Sabila punya fitur Auto-Kill Port yang membuat hidup Anda jauh lebih tenang. Anda berhak melanjutkan ke misi berikutnya!
<br><br>

<details>
<summary><b>Misi 2: Anda butuh database MySQL tapi lupa password root. Langkah Anda?</b> <i>(Klik untuk menjawab)</i></summary>
<br>
<blockquote>
<details>
<summary>🔴 A. Install ulang Windows.</summary>
<br>
<i>Wah ekstrim banget! Nggak perlu sampai install ulang, tenang.</i>
</details>
<details>
<summary>🟢 B. Buka tab "Database" di Sabila dan klik satu tombol untuk masuk tanpa password!</summary>
<br>
<b>🏆 SELAMAT! ANDA MENANG!</b><br>
Anda telah membuktikan diri sebagai developer masa depan yang cerdas. Sebagai hadiahnya, Anda berhak... menraktir saya kopi! ☕😆<br>
👉 <a href="https://trakteer.id/sabila-hq"><b>Klaim Hadiah Anda (Traktir Developer)</b></a>
</details>
</blockquote>

</details>

</details>
</blockquote>
</details>

---

## 💻 Cara Menjalankan dari Kode Sumber (Development)

Jika Anda ingin berkontribusi atau menjalankan Sabila langsung dari kode sumber:

### Prasyarat
- Node.js versi 18 ke atas.
- NPM atau Yarn.

### Langkah-langkah
1. Klon repositori ini:
   ```bash
   git clone https://github.com/sabila-hq/sabila-hq.github.io.git
   cd sabila
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Jalankan server pengembangan (development mode):
   ```bash
   npm run dev
   ```
4. Build aplikasi menjadi file installer `.exe` untuk Windows:
   ```bash
   npm run build:win
   ```

---

## 📄 Lisensi & Syarat Penggunaan

Proyek ini dilisensikan di bawah **BSD 3-Clause License**. Silakan baca detail selengkapnya di file [LICENSE](LICENSE).
---

Dibuat dengan cinta ❤️ untuk memajukan generasi developer muda Indonesia.  
Untuk pertanyaan lebih lanjut atau kerjasama, silakan kunjungi [github.com/faruq1997](https://github.com/faruq1997/).
