import SukoharjoMap from "./SukoharjoMap";

export default function Hero() {
  return (
    <section className="bg-green-50 py-20">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">

        {/* KIRI */}
        <div>
          <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm">
            SISTEM CERDAS UNTUK PERTANIAN MODERN
          </span>

          <h1 className="text-6xl font-bold mt-6 leading-tight">
            Prediksi Hasil Panen Padi
            <span className="text-green-700">
              {" "}Menggunakan Random Forest
            </span>
            <br />
            & Rule Based System
          </h1>

          <p className="mt-6 text-gray-600 text-lg">
            GeoPanen menggabungkan Machine Learning,
            GIS, dan Rule Based System untuk membantu
            petani memprediksi hasil panen secara
            akurat dan cepat di Kabupaten Sukoharjo.
          </p>

          <div className="mt-8 flex gap-4">
            <button className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-lg transition">
              Mulai Prediksi
            </button>

            <button className="border border-green-700 text-green-700 hover:bg-green-700 hover:text-white px-6 py-3 rounded-lg transition">
              Lihat Demo
            </button>
          </div>

          {/* Statistik Singkat */}
          <div className="flex gap-10 mt-10">
            <div>
              <h3 className="text-2xl font-bold text-green-700">
                98%
              </h3>
              <p className="text-gray-600">
                Akurasi AI
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-green-700">
                10K+
              </h3>
              <p className="text-gray-600">
                Data Panen
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-green-700">
                12
              </h3>
              <p className="text-gray-600">
                Kecamatan
              </p>
            </div>
          </div>
        </div>

        {/* KANAN - PETA GIS */}
        <div className="relative">

          <SukoharjoMap />

          {/* Floating Card */}
          <div className="absolute top-5 right-5 bg-white p-4 rounded-2xl shadow-xl z-[1000] w-64">

            <h3 className="font-bold text-lg">
              Sawah Grogol
            </h3>

            <p className="text-green-700 text-3xl font-bold mt-2">
              6.25 ton/ha
            </p>

            <p className="text-gray-600 mt-2">
              Tingkat Keyakinan
            </p>

            <div className="w-full bg-gray-200 h-3 rounded mt-2">
              <div className="bg-green-600 h-3 w-[92%] rounded"></div>
            </div>

            <p className="mt-2 text-sm text-green-700 font-medium">
              Status Produktivitas Tinggi
            </p>

          </div>

        </div>

      </div>
    </section>
  );
}