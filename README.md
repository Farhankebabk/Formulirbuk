# Formulir PPDB — EARTH / FUNCTION

## File
- `index.html` — struktur formulir
- `style.css` — desain responsif, light/dark theme
- `script.js` — validasi, dialog konfirmasi, ekspor JSON
- `assets/logo-sman19-palembang.png` — logo sekolah yang diberikan

## Cara menjalankan
Buka `index.html` menggunakan browser modern. Tidak membutuhkan framework atau instalasi dependency.

## Fungsi yang tersedia
- Validasi kolom wajib, format nomor telepon, NISN 10 digit, dan tahun lulus.
- Pilihan agama, jenis kelamin, dan jalur pendaftaran.
- Konfirmasi setelah formulir valid.
- Unduh data yang diisi dalam format JSON.
- Tema mengikuti pengaturan sistem operasi.

## Catatan integrasi
Versi ini memvalidasi data di browser dan menyediakan ekspor JSON. Data TIDAK dikirim atau disimpan ke server sekolah. Untuk pendaftaran sungguhan, hubungkan event submit ke backend/API resmi dan pastikan kebijakan privasi, keamanan, serta persetujuan penggunaan data peserta didik tersedia.

## Penyesuaian sebelum produksi
- Ganti tahun ajaran sesuai periode penerimaan.
- Verifikasi nomor WhatsApp, email, dan akun media sosial sekolah.
- Logo SMA Negeri 19 Palembang sudah dipasang dari aset yang diberikan.
- Sesuaikan pilihan jalur dan aturan validasi dengan ketentuan PPDB yang berlaku.
