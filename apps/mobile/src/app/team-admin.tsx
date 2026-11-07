import type { TeamInfo } from '@ugent/core';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Avatar, Group, PlanBadge } from '@/components/kit';
import { Button, Card, Field, Header, IconButton, Pill, Row, Screen, Section, Sheet, T, useToast } from '@/components/ui';
import { ApiError, apiConfigured, request } from '@/lib/api';
import { syncNow } from '@/lib/sync';
import { memberColor, refreshTeam } from '@/lib/team';
import { effectivePlan, useApp } from '@/store';
import { useColors } from '@/theme';

type Member = TeamInfo['members'][number];

/** Team admin: invite, roles, removal; or create/join a team. */
export default function TeamAdmin() {
  const c = useColors();
  const toast = useToast();
  const state = useApp();
  const { team, me } = state;
  const plan = effectivePlan(state);
  const isAdmin = me?.teamRole === 'admin';
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [picked, setPicked] = useState<Member | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const act = async (fn: () => Promise<{ team: TeamInfo | null }>, done: string) => {
    try {
      const res = await fn();
      state.setTeam(res.team);
      await syncNow();
      await refreshTeam();
      if (!res.team) state.setWorkspace('personal');
      toast(done);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Connect to the internet to manage your team.');
    }
  };

  if (!apiConfigured()) {
    return <Screen><Header back title="Team" /><T muted>Teams need Ugent's servers, which this build is not set up with.</T></Screen>;
  }

  if (!team) {
    return (
      <Screen>
        <Header back title="Your team" sub="Share a calendar and tasks with your family, shop or company." />
        {plan === 'team' ? (
          <Section title="Create a team">
            <Field label="Team name" value={name} onChangeText={setName} placeholder="e.g. Adeyemi Foods" />
            <Button label="Create team" disabled={!name.trim()} onPress={() => act(() => request('POST', '/api/team', { name: name.trim() }), 'Team created. Invite people with your code.')} />
          </Section>
        ) : (
          <Card>
            <T>Creating a team needs the Team plan ($21 a month). Everyone you invite is covered.</T>
            <Button kind="ghost" label="See the Team plan" onPress={() => router.push('/pricing')} />
          </Card>
        )}
        <Section title="Join a team">
          <Field label="Invite code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="6 letters" autoCapitalize="characters" maxLength={8} />
          <Button kind="ghost" label="Join" disabled={code.trim().length < 4} onPress={() => act(() => request('POST', '/api/team/join', { code: code.trim() }), 'You joined the team')} />
        </Section>
      </Screen>
    );
  }

  const invite = `Join my team "${team.name}" on Ugent. Open Ugent > More > Members, and enter the code ${team.code}.`;
  return (
    <Screen>
      <Header back title={isAdmin ? 'Members and roles' : 'Members'} sub={team.name} right={<PlanBadge plan="team" />} />
      {isAdmin && (
        <Card tint>
          <T v="small" muted>Invite code</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="hero" selectable style={{ letterSpacing: 4 }}>{team.code}</T>
            <IconButton icon="copy" label="Copy invite code" color={c.skyInk} onPress={async () => { await Clipboard.setStringAsync(team.code); toast('Invite code copied'); }} />
          </View>
          <Button compact icon="send" label="Invite on WhatsApp" onPress={() => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(invite)}`).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(invite)}`))} />
        </Card>
      )}
      <Group title={`Members (${team.members.length})`}>
        {team.members.map((m) => (
          <Row key={m.id} title={m.id === me?.id ? `${m.name} (you)` : m.name} sub={m.role === 'admin' ? 'Admin: manages members and roles' : 'Member'}
            right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{m.role === 'admin' && <Pill label="Admin" tone="sky" />}<Avatar name={m.name} size={30} color={memberColor(m.id, team)} /></View>}
            onPress={isAdmin && m.id !== me?.id ? () => setPicked(m) : undefined} />
        ))}
      </Group>
      {isAdmin && <T v="small" muted>Tap a member to change their role or remove them.</T>}
      <Button kind="danger" label={isAdmin && team.members.length === 1 ? 'Close the team' : 'Leave team'} onPress={() => setConfirmLeave(true)} />

      <Sheet visible={!!picked} onClose={() => setPicked(null)} title={picked?.name}>
        {picked && (
          <Group>
            <Row icon="shield" title={picked.role === 'admin' ? 'Make a member' : 'Make an admin'} sub={picked.role === 'admin' ? 'They will no longer manage the team' : 'They can invite, remove and change roles'}
              onPress={() => { setPicked(null); void act(() => request('PATCH', `/api/team/members/${picked.id}`, { role: picked.role === 'admin' ? 'member' : 'admin' }), 'Role updated'); }} />
            <Row icon="x" title="Remove from team" danger onPress={() => { setPicked(null); void act(() => request('DELETE', `/api/team/members/${picked.id}`), `${picked.name} removed`); }} />
          </Group>
        )}
      </Sheet>
      <Sheet visible={confirmLeave} onClose={() => setConfirmLeave(false)} title={isAdmin && team.members.length === 1 ? 'Close the team?' : 'Leave the team?'}>
        <T muted>{team.members.length > 1 && isAdmin ? 'If you created this team, leaving closes it for everyone and shared items become private to their owners.' : 'Shared plans and tasks will no longer show for you.'}</T>
        <Button kind="danger" label="Yes, leave" onPress={() => { setConfirmLeave(false); void act(() => request('POST', '/api/team/leave'), 'You left the team'); }} />
      </Sheet>
    </Screen>
  );
}
