import type { TeamInfo } from '@ugent/core';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, Header, IconButton, List, Pill, Row, Screen, Section, T, useToast } from '@/components/ui';
import { ApiError, apiConfigured, ensureSession, request } from '@/lib/api';
import { syncNow } from '@/lib/sync';
import { effectivePlan, useApp } from '@/store';
import { useColors } from '@/theme';

export default function Team() {
  const c = useColors();
  const toast = useToast();
  const state = useApp();
  const plan = effectivePlan(state);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const isAdmin = state.me?.teamRole === 'admin';

  const load = useCallback(async () => {
    if (!apiConfigured()) { setLoading(false); return; }
    try {
      await ensureSession(useApp.getState().profile);
      setTeam((await request<{ team: TeamInfo | null }>('GET', '/api/team')).team);
    } catch { toast('Connect to the internet to manage your team.'); } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<{ team: TeamInfo | null }>, done: string) => {
    try {
      const res = await fn();
      setTeam(res.team);
      await syncNow();
      toast(done);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    }
  };

  if (!apiConfigured()) {
    return <Screen><Header back title="Your team" /><T muted>Teams need an internet connection to Ugent's servers, which this build is not set up with.</T></Screen>;
  }

  return (
    <Screen>
      <Header back title="Your team" sub={team ? team.name : 'Share a calendar with your family, shop or small team.'} />
      {loading ? <T muted>Loading…</T> : team ? (
        <>
          <Card tint>
            <T v="small" muted>Invite code</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T v="hero" selectable style={{ letterSpacing: 4 }}>{team.code}</T>
              <IconButton icon="copy" label="Copy invite code" color={c.skyInk} onPress={async () => { await Clipboard.setStringAsync(team.code); toast('Invite code copied'); }} />
            </View>
            <T v="small">People join from More, Your team, with this code. Plans you mark as Team show on everyone's schedule.</T>
          </Card>
          <Section title={`Members (${team.members.length})`}>
            <List>
              {team.members.map((m) => (
                <Row key={m.id} title={m.id === state.me?.id ? `${m.name} (you)` : m.name}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {m.role === 'admin' && <Pill label="Admin" tone="sky" />}
                      {isAdmin && m.id !== state.me?.id && (
                        <IconButton icon="x" label={`Remove ${m.name}`} onPress={() => void act(() => request('DELETE', `/api/team/members/${m.id}`), `${m.name} removed`)} />
                      )}
                    </View>
                  } />
              ))}
            </List>
          </Section>
          <Button kind="danger" label={isAdmin ? 'Close the team' : 'Leave team'} onPress={() => void act(() => request('POST', '/api/team/leave'), isAdmin ? 'Team closed' : 'You left the team')} />
        </>
      ) : (
        <>
          {plan === 'team' ? (
            <Section title="Create your team">
              <Field label="Team name" value={name} onChangeText={setName} placeholder="e.g. Adeyemi Family" />
              <Button label="Create team" disabled={!name.trim()} onPress={() => void act(() => request('POST', '/api/team', { name: name.trim() }), 'Team created')} />
            </Section>
          ) : (
            <Card>
              <T>Creating a team needs the Team plan. You can still join a team someone invites you to.</T>
              <Button kind="ghost" label="See the Team plan" onPress={() => router.push('/pricing')} />
            </Card>
          )}
          <Section title="Join a team">
            <Field label="Invite code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="6 letters" autoCapitalize="characters" maxLength={8} />
            <Button kind="ghost" label="Join" disabled={code.trim().length < 4} onPress={() => void act(() => request('POST', '/api/team/join', { code: code.trim() }), 'You joined the team')} />
          </Section>
        </>
      )}
    </Screen>
  );
}
