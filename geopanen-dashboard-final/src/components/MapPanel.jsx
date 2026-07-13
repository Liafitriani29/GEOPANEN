export default function MapPanel(){
  return (
    <div style={styles.map}>
      MAP AREA (GeoPanen GIS)
    </div>
  )
}

const styles = {
  map:{
    height:"100%",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    background:"#fff",
    borderRadius:12,
    fontWeight:500,
    opacity:0.6
  }
}