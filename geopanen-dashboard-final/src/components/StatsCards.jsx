export default function StatsCards() {
  const data = [
    {label:"Total Lahan", value:"128.6 Ha", color:"#16a34a"},
    {label:"Rata Panen", value:"6.78 Ton/Ha", color:"#0ea5e9"},
    {label:"Potensi Tinggi", value:"64.3 Ha", color:"#f59e0b"},
    {label:"Akurasi", value:"92.4%", color:"#8b5cf6"},
  ]

  return (
    <div style={styles.grid}>
      {data.map((d,i)=>(
        <div key={i} style={styles.card}>
          <div style={{fontSize:12,opacity:0.6}}>{d.label}</div>
          <div style={{fontSize:18,color:d.color,fontWeight:600}}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  )
}

const styles = {
  grid:{
    display:"grid",
    gridTemplateColumns:"repeat(4,1fr)",
    gap:10,
    padding:10
  },
  card:{
    background:"#fff",
    padding:12,
    borderRadius:12,
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)"
  }
}