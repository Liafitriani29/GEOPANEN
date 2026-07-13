export default function PrediksiPanel(){
  return (
    <div style={styles.card}>
      <h3>Prediksi Panen</h3>
      <h2 style={{color:"#16a34a"}}>7.85 Ton</h2>
      <p>Range: 7.2 - 8.5 Ton/Ha</p>
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