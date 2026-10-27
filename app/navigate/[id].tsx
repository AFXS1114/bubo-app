import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { listTraps } from '@/database/database';
import { Trap } from '@/models/types';
import { GPSReading, getCurrentGPS, watchGPS } from '@/services/gps/LocationService';
import { bearingDegrees, distanceMeters, formatDistance } from '@/services/navigation/NavigationMath';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
type Coordinate = [number, number];

function lineFeature(from: Coordinate, to: Coordinate) {
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [from, to] } };
}

export default function NavigateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trap, setTrap] = React.useState<Trap | null>(null);
  const [gps, setGps] = React.useState<GPSReading | null>(null);
  const [gpsError, setGpsError] = React.useState(false);
  const [mapFailed, setMapFailed] = React.useState(false);
  const [dashPhase, setDashPhase] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | undefined;
    listTraps().then((items) => { if (active) setTrap(items.find((item) => item.id === Number(id)) ?? null); }).catch(() => setTrap(null));
    getCurrentGPS().then((reading) => {
      if (active) setGps(reading);
      return watchGPS((next) => { if (active) { setGps(next); setGpsError(false); } });
    }).then((watcher) => { subscription = watcher; }).catch(() => { if (active) setGpsError(true); });
    const timer = setInterval(() => setDashPhase((phase) => !phase), 700);
    return () => { active = false; subscription?.remove(); clearInterval(timer); };
  }, [id]);

  if (!trap) return <SafeAreaView style={s.safe}><Text style={s.title}>LOADING TRAP…</Text></SafeAreaView>;
  const target: Coordinate = [trap.longitude, trap.latitude];
  const current: Coordinate | null = gps ? [gps.longitude, gps.latitude] : null;
  const ne: Coordinate = gps ? [Math.max(gps.longitude, trap.longitude), Math.max(gps.latitude, trap.latitude)] : target;
  const sw: Coordinate = gps ? [Math.min(gps.longitude, trap.longitude), Math.min(gps.latitude, trap.latitude)] : target;
  const meters = gps ? distanceMeters(gps, trap) : null;
  const bearing = gps ? Math.round(bearingDegrees(gps, trap)) : null;

  const refreshGPS = async () => {
    try { setGps(await getCurrentGPS()); setGpsError(false); }
    catch { setGpsError(true); Alert.alert('GPS unavailable', 'Enable location permission and GPS, then try again.'); }
  };

  return <SafeAreaView style={s.safe}>
    <View style={s.topBar}>
      <Pressable onPress={() => router.back()} style={s.backButton}><Text style={s.backText}>‹ BACK</Text></Pressable>
      <View style={s.heading}><Text style={s.title}>NAVIGATE TO</Text><Text style={s.trapCode}>{trap.trapCode}</Text></View>
      <Pressable onPress={refreshGPS} style={s.refresh}><Text style={s.refreshText}>◎</Text></Pressable>
    </View>

    <View style={s.metrics}>
      <View style={s.metric}><Text style={s.metricLabel}>DISTANCE</Text><Text style={s.metricValue}>{meters === null ? '—' : formatDistance(meters)}</Text></View>
      <View style={s.metric}><Text style={s.metricLabel}>BEARING</Text><Text style={s.metricValue}>{bearing === null ? '—' : `${bearing}°`}</Text></View>
      <View style={s.metric}><Text style={s.metricLabel}>GPS ACCURACY</Text><Text style={[s.metricValue, gps && gps.accuracy > 20 ? s.warn : null]}>{gps ? `±${Math.round(gps.accuracy)} m` : '—'}</Text></View>
    </View>

    <View style={s.map}>
      {!gps ? <View style={s.waiting}><ActivityIndicator color="#67e8f9" size="large"/><Text style={s.waitText}>{gpsError ? 'GPS unavailable. Check location permission and GPS.' : 'Acquiring GPS position…'}</Text><Pressable onPress={refreshGPS} style={s.gpsButton}><Text style={s.gpsButtonText}>RETRY GPS</Text></Pressable></View> : mapFailed ? <View style={s.waiting}><Text style={s.mapOffline}>MAP TILES UNAVAILABLE</Text><Text style={s.waitText}>Direct bearing and distance work without map tiles. Reconnect to load the map.</Text></View> : <MapLibreGL.MapView style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} onDidFailLoadingMap={() => setMapFailed(true)}>
        <MapLibreGL.Camera bounds={{ ne, sw }} padding={{ paddingTop: 60, paddingRight: 48, paddingBottom: 60, paddingLeft: 48 }} animationMode="easeTo" animationDuration={500} />
        {current && <MapLibreGL.PointAnnotation id="navigation-current" coordinate={current}><View style={s.currentHalo}><View style={s.currentDot}/></View></MapLibreGL.PointAnnotation>}
        <MapLibreGL.PointAnnotation id="navigation-trap" coordinate={target}><View style={s.trapPin}><Text style={s.pinFlag}>⚑</Text></View></MapLibreGL.PointAnnotation>
        {current && <MapLibreGL.ShapeSource id="direct-bearing" shape={lineFeature(current, target)}><MapLibreGL.LineLayer id="direct-bearing-line" style={{ lineColor: '#ffbd4a', lineWidth: 4, lineOpacity: 0.95, lineCap: 'round', lineJoin: 'round', lineDasharray: dashPhase ? [1, 2] : [2, 1] }} /></MapLibreGL.ShapeSource>}
      </MapLibreGL.MapView>}
      <View style={s.legend}><View style={s.legendRow}><View style={s.legendCurrent}/><Text style={s.legendText}>YOU</Text></View><View style={s.legendRow}><View style={s.legendTrap}/><Text style={s.legendText}>TRAP</Text></View><Text style={s.directLabel}>DIRECT BEARING • NOT A SAFE ROUTE</Text></View>
    </View>

    <View style={s.footer}><Text style={s.footerText}>{gps ? `GPS updated live${gps.accuracy > 20 ? ' · Accuracy is limited' : ''}` : 'Waiting for GPS fix'}</Text><Text style={s.coordinates}>{trap.latitude.toFixed(6)}, {trap.longitude.toFixed(6)}</Text><Pressable onPress={() => router.back()} style={s.stop}><Text style={s.stopText}>STOP NAVIGATION</Text></Pressable></View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#071923',paddingHorizontal:16,paddingTop:8},topBar:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},backButton:{minWidth:68,paddingVertical:12},backText:{color:'#9db5bd',fontSize:13,fontWeight:'900'},heading:{alignItems:'center'},title:{color:'#a9c5cd',fontSize:11,fontWeight:'900',letterSpacing:1.2},trapCode:{color:'#fff',fontSize:18,fontWeight:'900',marginTop:2},refresh:{width:44,height:44,borderRadius:22,backgroundColor:'#173c48',alignItems:'center',justifyContent:'center'},refreshText:{color:'#67e8f9',fontSize:26},metrics:{flexDirection:'row',gap:8,marginVertical:10},metric:{flex:1,backgroundColor:'#102c38',borderRadius:12,paddingVertical:12,paddingHorizontal:10},metricLabel:{fontSize:9,color:'#8aa9b2',fontWeight:'900',letterSpacing:.5},metricValue:{color:'#fff',fontSize:19,fontWeight:'900',marginTop:6},warn:{color:'#ffcc66'},map:{flex:1,backgroundColor:'#173c48',borderRadius:16,overflow:'hidden'},waiting:{flex:1,alignItems:'center',justifyContent:'center',padding:30,gap:14},waitText:{color:'#c1d7dd',textAlign:'center',lineHeight:22,fontSize:15},gpsButton:{backgroundColor:'#67e8f9',borderRadius:9,paddingVertical:12,paddingHorizontal:20,marginTop:4},gpsButtonText:{color:'#071923',fontWeight:'900'},mapOffline:{fontSize:17,color:'#ffcc66',fontWeight:'900'},currentHalo:{width:30,height:30,borderRadius:15,backgroundColor:'rgba(103,232,249,.35)',alignItems:'center',justifyContent:'center'},currentDot:{width:13,height:13,borderRadius:7,backgroundColor:'#67e8f9',borderWidth:2,borderColor:'#06212a'},trapPin:{width:38,height:38,borderRadius:20,backgroundColor:'#ffcf66',alignItems:'center',justifyContent:'center',borderColor:'#071923',borderWidth:2},pinFlag:{fontSize:21,color:'#071923'},legend:{position:'absolute',left:12,right:12,bottom:12,backgroundColor:'rgba(7,25,35,.91)',borderRadius:11,padding:12,flexDirection:'row',alignItems:'center',gap:16},legendRow:{flexDirection:'row',alignItems:'center',gap:6},legendCurrent:{width:12,height:12,borderRadius:6,backgroundColor:'#67e8f9'},legendTrap:{width:12,height:12,borderRadius:6,backgroundColor:'#ffcf66'},legendText:{color:'#fff',fontSize:10,fontWeight:'900'},directLabel:{flex:1,textAlign:'right',color:'#ffcf66',fontSize:8,fontWeight:'900'},footer:{paddingTop:12,paddingBottom:8},footerText:{color:'#9db5bd',textAlign:'center',fontSize:12,fontWeight:'700'},coordinates:{color:'#fff',textAlign:'center',fontSize:12,fontVariant:['tabular-nums'],marginTop:4},stop:{backgroundColor:'#263e48',borderRadius:10,paddingVertical:14,alignItems:'center',marginTop:10},stopText:{color:'#fff',fontSize:13,fontWeight:'900',letterSpacing:.5}
});
