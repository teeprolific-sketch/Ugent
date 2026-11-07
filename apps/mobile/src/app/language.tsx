import { langMeta } from '@ugent/core';
import { LanguageList } from '@/components/kit';
import { Header, Screen, T, useToast } from '@/components/ui';
import { useApp } from '@/store';
import { setFontLanguage } from '@/theme';

export default function Language() {
  const toast = useToast();
  const lang = useApp((s) => s.profile.lang);
  const setProfile = useApp((s) => s.setProfile);
  return (
    <Screen>
      <Header back title="Language" sub="Ugent replies in this language. You can mix languages when you talk to it." />
      <LanguageList value={lang} onChange={(l) => { setFontLanguage(l); setProfile({ lang: l }); toast(`Language: ${langMeta(l).native}`); }} />
      <T v="small" muted>Voice input for Yoruba, Igbo and Hausa depends on your phone's speech support.</T>
    </Screen>
  );
}
