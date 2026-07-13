export default function AkurasiModel(){
  return (
    <div style={styles.card}>
      <h3>Akurasi Model</h3>
      <h2 style={{color:"#8b5cf6"}}>92.4%</h2>
      <p>Random Forest</p>
    </div>
  )
}

const styles = {
  card:{
    background:"#fff",
    padding:12,
    borderRadius:12
  }
}