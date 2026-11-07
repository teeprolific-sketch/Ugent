import { fmtDate, fromMin, toMin } from '@ugent/core';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Group } from '@/components/kit';
import { Button, Card, Field, Header, Pill, Row, Screen, Section, Segmented, T, useToast } from '@/components/ui';
import { useLang } from '@/hooks';
import { directionsUrl } from '@/lib/actions';
import { connect, disconnect } from '@/lib/connections';
import { dayWord, fmtTime } from '@/lib/format';
import { travelMinutes } from '@/lib/maps';
import { plannerState, useApp } from '@/store';

/** Location and Google Maps: places, travel buffer, live traffic and directions. */
export default function Maps() {
  const toast = useToast();
  const lang = useLang();
  const state = useApp();
  const on = !!state.connections.googleMaps?.on;
  const live = !!state.cloud.find((c) => c.provider === 'googleMaps')?.available;
  const [home, setHome] = useState(state.places.home);
  const [work, setWork] = useState(state.places.work);
  const [eta, setEta] = useState<string | null>(null);
  const f = fmtTime(lang);
  const d0 = fmtDate(new Date());
  const withPlace = plannerState(state).events.filter((e) => e.location && e.date >= d0).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 5);

  return (
    <Screen>
      <Header back title="Location and maps" sub="Powered by Google Maps" />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T v="h3">Google Maps</T>
          <Pill label={on ? 'Connected' : 'Not connected'} tone={on ? 'good' : 'plain'} />
        </View>
        <T v="small">Ugent uses your location only to work out travel times and when you should leave. It is not stored on the server.</T>
        <View style={{ flexDirection: 'row', gap: 8 }}><Pill label={live ? 'Live traffic on' : 'Live traffic not set up yet'} tone={live ? 'sky' : 'plain'} /></View>
        {on ? <Button kind="ghost" label="Disconnect" onPress={async () => toast(await disconnect('googleMaps'))} /> : <Button label="Allow location" icon="pin" onPress={async () => toast(await connect('googleMaps'))} />}
      </Card>

      <Section title="Your places">
        <Field label="Home" value={home} onChangeText={setHome} onBlur={() => state.setPlaces({ home: home.trim() })} placeholder="e.g. Gbagada, Lagos" />
        <Field label="Work" value={work} onChangeText={setWork} onBlur={() => state.setPlaces({ work: work.trim() })} placeholder="e.g. Victoria Island, Lagos" />
        {work.trim().length > 2 && (
          <Button kind="ghost" icon="car" label="How long to work right now?" onPress={async () => {
            state.setPlaces({ home: home.trim(), work: work.trim() });
            const r = await travelMinutes(work.trim());
            setEta(r.live ? `About ${r.minutes} minutes with current traffic.` : `Live traffic isn't set up yet, so Ugent uses your ${r.minutes}-minute buffer.`);
          }} />
        )}
        {eta && <T>{eta}</T>}
      </Section>

      <Section title="Travel buffer">
        <T v="small" muted>When live traffic isn't available, Ugent assumes this much travel time before plans that have a place.</T>
        <Segmented value={state.settings.travelBuffer} onChange={(m: number) => state.setSettings({ travelBuffer: m })} options={[[30, '30 min'], [45, '45 min'], [60, '1 h'], [90, '1 h 30']]} />
      </Section>

      <Section title="Coming up with a place">
        {withPlace.length ? (
          <Group>
            {withPlace.map((e) => (
              <Row key={e.id} icon="pin" title={e.title} sub={`${dayWord(e.date, lang)}, ${f(e.start)} · ${e.location} · leave by ${f(fromMin(toMin(e.start) - state.settings.travelBuffer - 10))}`}
                onPress={() => Linking.openURL(directionsUrl(e.location!))} chevron />
            ))}
          </Group>
        ) : <T muted>Add a place to a plan and it will show here with directions.</T>}
      </Section>
    </Screen>
  );
}
