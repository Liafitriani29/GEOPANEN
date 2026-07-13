export default function Topbar() {
  return (
    <div style={styles.topbar}>

      <h3>Dashboard Petani</h3>

      <div style={{display:"flex", gap:10}}>
        <select><option>Sukoharjo</option></select>
        <select><option>Nguter</option></select>
        <select><option>Desa Nguter</option></select>
      </div>

    </div>
  )
}

const styles = {
  topbar:{
    background:"#fff",
    padding:12,
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    borderBottom:"1px solid #e5e7eb"
  }
}