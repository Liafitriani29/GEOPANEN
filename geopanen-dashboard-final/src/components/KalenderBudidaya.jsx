export default function KalenderBudidaya() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div>
      <h3>Kalender Budidaya</h3>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(7,1fr)",
        gap:6
      }}>
        {days.map(d => (
          <div key={d} style={dayBox}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

const dayBox = {
  background:"#f3f4f6",
  padding:8,
  borderRadius:6,
  textAlign:"center",
  fontSize:12
};