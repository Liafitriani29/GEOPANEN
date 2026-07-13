export default function DemoPrediction() {
  return (
    <section className="bg-gray-50 py-16">

      <div className="max-w-5xl mx-auto">

        <div className="bg-white shadow-lg rounded-2xl p-8">

          <h2 className="text-2xl font-bold">
            Contoh Hasil Prediksi
          </h2>

          <div className="mt-6">

            <h3 className="font-bold text-xl">
              Sawah Grogol
            </h3>

            <p className="text-green-700 text-3xl font-bold mt-2">
              6.25 ton/ha
            </p>

            <p className="mt-2">
              Status : Tinggi
            </p>

            <p className="mt-2">
              Rekomendasi :
              Pemupukan susulan 7 hari lagi.
            </p>

          </div>

        </div>

      </div>

    </section>
  );
}