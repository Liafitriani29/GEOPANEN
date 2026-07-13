const fitur = [
  {
    title: "Pemetaan Lahan GIS",
    desc: "Visualisasi lahan sawah berbasis peta interaktif.",
  },
  {
    title: "Prediksi AI",
    desc: "Random Forest untuk prediksi hasil panen.",
  },
  {
    title: "Rule Based System",
    desc: "Validasi hasil menggunakan aturan pertanian.",
  },
  {
    title: "Rekomendasi Cerdas",
    desc: "Saran peningkatan produktivitas.",
  },
];

export default function Features() {
  return (
    <section className="py-16 bg-white">

      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-6">

        {fitur.map((item, index) => (
          <div
            key={index}
            className="bg-gray-50 p-6 rounded-xl shadow-sm"
          >
            <h3 className="font-bold text-xl mb-3">
              {item.title}
            </h3>

            <p className="text-gray-600">
              {item.desc}
            </p>
          </div>
        ))}

      </div>

    </section>
  );
}