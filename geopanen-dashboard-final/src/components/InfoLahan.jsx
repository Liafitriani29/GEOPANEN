export default function InfoLahan(){
  return (
    <div style={styles.card}>

      <h3>Informasi Lahan</h3>

      <p>Pak Budi - 1.20 Ha</p>
      <p>Varietas: Inpari 32</p>
      <p>HST: 35</p>

    </div>
  )
}

const styles = {
  card:{
    background:"#fff",
    padding:12,
    borderRadius:12,
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)"
  }
}