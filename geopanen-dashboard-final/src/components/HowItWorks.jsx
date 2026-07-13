export default function HowItWorks() {
  return (
    <section className="py-20">

      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-4xl font-bold text-center mb-12">
          3 Langkah Mudah Prediksi Panen
        </h2>

        <div className="grid md:grid-cols-3 gap-10">

          <div className="text-center">
            <h3 className="text-2xl font-bold">1</h3>
            <p className="mt-3">
              Input data lahan dan cuaca
            </p>
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-bold">2</h3>
            <p className="mt-3">
              Analisis AI dan Rule
            </p>
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-bold">3</h3>
            <p className="mt-3">
              Hasil Prediksi Panen
            </p>
          </div>

        </div>

      </div>

    </section>
  );
}