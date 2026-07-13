export default function Navbar() {
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

        <div>
          <h1 className="text-3xl font-bold text-green-700">
            GeoPanen
          </h1>
          <p className="text-xs text-gray-500">
            Prediksi Hasil Panen Padi
          </p>
        </div>

        <div className="hidden md:flex gap-8 font-medium">
          <a href="#">Beranda</a>
          <a href="#">Fitur</a>
          <a href="#">Cara Kerja</a>
          <a href="#">Teknologi</a>
          <a href="#">Manfaat</a>
          <a href="#">Tentang Kami</a>
        </div>

        <div className="flex gap-3">
          <button className="border px-4 py-2 rounded-lg">
            Masuk
          </button>

          <button className="bg-green-700 text-white px-4 py-2 rounded-lg">
            Daftar Petani
          </button>
        </div>

      </div>
    </nav>
  );
}