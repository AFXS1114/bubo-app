import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { listTraps } from '@/database/database';
import { Trap } from '@/models/types';
import { getCurrentGPS, GPSReading } from '@/services/gps/LocationService';

const DEFAULT_CENTER: [number, number] = [123.982341, 10.315672];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function trapFeatureCollection(traps: Trap[]) {
  return {
    type: 'FeatureCollection' as const,
    features: traps.map((trap) => ({
      type: 'Feature' as const,
      id: String(trap.id),
      properties: { trapId: trap.id, trapCode: trap.trapCode },
      geometry: { type: 'Point' as const, coordinates: [trap.longitude, trap.latitude] },
    })),
  };
}

export default function MapScreen() {
  const [traps, setTraps] = React.useState<Trap[]>([]);
  const [gps, setGps] = React.useState<GPSReading | null>(null);
  const [mapFailed, setMapFailed] = React.useState(false);

  React.useEffect(() => {
    listTraps().then(setTraps).catch(() => setTraps([]));
    getCurrentGPS().then(setGps).catch(() => undefined);
  }, []);

  const center: [number, number] = gps ? [gps.longitude, gps.latitude] : DEFAULT_CENTER;
  const refreshGPS = async () => {
    try { setGps(await getCurrentGPS()); }
    catch { Alert.alert('GPS unavailable', 'Allow location access to center the map on your position.'); }
  };

  return <SafeAreaView style={s.safe}>
    <View style={s.header}>
      <Text style={s.brand}>BUBO</Text>
      <View><Text style={s.online}>{mapFailed ? '● OFFLINE MAP' : '● ONLINE MAP'}</Text><Text style={s.gps}>{gps ? `GPS ±${Math.round(gps.accuracy)} m` : 'GPS unavailable'}</Text></View>
    </View>
    <View style={s.map}>
      {mapFailed ? <View style={s.mapFallback}><Text style={s.mapTitle}>MAP OFFLINE</Text><Text style={s.mapSub}>Trap locations remain available locally. Reconnect to load the online map.</Text></View> : <MapLibreGL.MapView style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} onDidFailLoadingMap={() => setMapFailed(true)}>
        <MapLibreGL.Camera centerCoordinate={center} zoomLevel={gps ? 13 : 8} animationMode="flyTo" animationDuration={400} />
        {gps && <MapLibreGL.PointAnnotation id="current-position" coordinate={[gps.longitude, gps.latitude]}><View style={s.current}><View style={s.currentDot} /></View></MapLibreGL.PointAnnotation>}
        <MapLibreGL.ShapeSource id="traps" shape={trapFeatureCollection(traps)} onPress={(event) => { const id = Number(event.features[0]?.properties?.trapId); if (id) router.push({ pathname: '/trap/[id]', params: { id } }); }}>
          <MapLibreGL.CircleLayer id="trap-circles" style={{ circleColor: '#ffcf66', circleRadius: 9, circleStrokeColor: '#071923', circleStrokeWidth: 2 }} />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>}
      <Pressable onPress={refreshGPS} style={s.locate}><Text style={s.locateText}>◎</Text></Pressable>
      <View style={s.count}><Text style={s.countText}>{traps.length} TRAPS SAVED LOCALLY</Text></View>
    </View>
    <Pressable onPress={() => router.push('/add-trap')} style={s.add}><Text style={s.addText}>+ ADD BUBO</Text></Pressable>
    <View style={s.nav}><Text style={[s.navText, s.active]}>MAP</Text><Pressable onPress={() => router.replace('/traps')}><Text style={s.navText}>TRAPS</Text></Pressable><Pressable onPress={() => router.replace('/settings')}><Text style={s.navText}>SETTINGS</Text></Pressable></View>
  </SafeAreaView>;
}

const s = StyleSheet.create({ safe:{flex:1,backgroundColor:'#071923',padding:16}, header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, brand:{color:'#67e8f9',fontSize:30,fontWeight:'900',letterSpacing:3}, online:{color:'#7ee5aa',fontWeight:'800',fontSize:12,textAlign:'right'}, gps:{color:'#9db5bd',fontSize:11,marginTop:3,textAlign:'right'}, map:{flex:1,borderRadius:18,marginVertical:18,overflow:'hidden',backgroundColor:'#173c48'}, mapFallback:{flex:1,justifyContent:'center',alignItems:'center',padding:28}, mapTitle:{color:'#d9f7fa',fontSize:22,fontWeight:'900',marginBottom:12}, mapSub:{color:'#9dc8ce',textAlign:'center',lineHeight:22}, locate:{position:'absolute',right:14,top:14,width:46,height:46,borderRadius:23,backgroundColor:'#f2f7f8',alignItems:'center',justifyContent:'center'}, locateText:{fontSize:28,color:'#071923'}, current:{width:24,height:24,borderRadius:12,backgroundColor:'rgba(103,232,249,.3)',alignItems:'center',justifyContent:'center'}, currentDot:{width:10,height:10,borderRadius:5,backgroundColor:'#67e8f9',borderWidth:2,borderColor:'#071923'}, count:{position:'absolute',bottom:14,left:14,backgroundColor:'rgba(7,25,35,.8)',padding:8,borderRadius:8}, countText:{color:'#b8dce0',fontWeight:'800',fontSize:11}, add:{backgroundColor:'#67e8f9',borderRadius:12,padding:18,alignItems:'center'}, addText:{fontWeight:'900',fontSize:16}, nav:{flexDirection:'row',justifyContent:'space-around',paddingTop:18}, navText:{color:'#9db5bd',fontWeight:'800'}, active:{color:'#67e8f9'} });
