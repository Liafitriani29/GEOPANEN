
export default function InfoPanel(){
  return (
    <div style={{
      background:'#111827',
      color:'#fff',
      padding:12,
      borderRadius:12
    }}>
      <h3>Informasi Lahan</h3>

      <p>Pak Budi - 1.20 Ha</p>
      <p>Varietas: Inpari 32</p>
      <p>HST: 35</p>

      <hr/>

      <h4>Prediksi</h4>
      <div style={{color:'#22c55e',fontSize:22}}>7.85 Ton</div>

      <h4>Rekomendasi</h4>
      <p>Urea 100 Kg/Ha</p>
    </div>
  )
}
