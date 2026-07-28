# Unrecovered legacy media (23 refs)

`3631_cinkov_kriz.pdf` (legacy_id 78, 79, 82) resolved via
`scripts/fix-cinkov-kriz-shared-pdf.ts` — see notable-pattern section below.

Produced by `scripts/recover-legacy-media-from-served-mirror.ts` (dry-run
log), following on from `scripts/rescue-stale-media.ts`. Both scripts fetch
from live buckets/mirror; if a row here is ever revisited, re-run
`--limit 1` against the relevant legacy_id rather than trusting this file's
urls to still resolve.

Reasons:
- **gone (2024, not mirrored)** — mirror (`D:\Luka\JKNM\served`) has nothing
  past 2023; these articles are from 2024.
- **no unique filename match** — legacy source exists but the stale url's
  filename didn't map to exactly one candidate (often a duplicate filename
  reused within the same article).
- **no legacy source** — legacy_id has no row in Objave.txt and no scraped
  `artifacts/legacy-html/<id>.html`.

| legacy_id | title | article | stale url | reason |
|---|---|---|---|---|
| 606 | Kočevski Rog je očiščen pnevmatik ... | https://jknm.org/kocevski-rog-je-ociscen-pnevmatik | https://jknm.s3.eu-central-1.amazonaws.com/kocevski-rog-je-ociscen-pnevmatik-05-06-2022/si | no unique filename match (not a real asset — malformed href fragment, belongs to the www.jknm.si link cleanup, not media) |
| 606 | Kočevski Rog je očiščen pnevmatik ... | https://jknm.org/kocevski-rog-je-ociscen-pnevmatik | https://jknm.s3.eu-central-1.amazonaws.com/kocevski-rog-je-ociscen-pnevmatik-05-06-2022/sidg.si/ | no unique filename match (same as above) |
| 116 | Pečenevka - hvalnica norosti | https://jknm.org/pecenevka-hvalnica-norosti | https://jknm.s3.eu-central-1.amazonaws.com/pecenevka-hvalnica-norosti-16-11-2009/851_pecenevka.pdf | no unique filename match |
| 145 | Desant na Kunč | https://jknm.org/desant-na-kunc | https://jknm.s3.eu-central-1.amazonaws.com/desant-na-kunc-09-04-2010/669_ledena_kunc.pdf | no unique filename match |
| 633 | Študenti biologije na obisku pri letečih Dolenjcih | https://jknm.org/studenti-biologije-na-obisku-pri-letecih-dolenjcih | https://jknm.s3.eu-central-1.amazonaws.com/studenti-biologije-na-obisku-pri-letecih-dolenjcih-16-01-2024/dk8_43_presetnik_hudoklin_tri_desetletja_spremljanja_zatocisc_netopirjev.pdf | no unique filename match |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_13.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_10.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_1.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_2.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_4.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_5.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_6.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_7.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_8.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_9.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../20240203_008.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_11.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm-novice.s3.eu-central-003.backblazeb2.com/.../radescica_02_12.jpg | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm.s3.eu-central-1.amazonaws.com/cistilna-akcija-vvo-izvira-radescice-ii-06-02-2024/v_dveh_dneh_izvlekli_za_tri_kontejnerje_smeti_dl_13_15_2_2024.pdf | gone (2024, not mirrored) |
| 637 | Čistilna akcija vodovarstvenega območja izvira Radeščice [2] | https://jknm.org/cistilna-akcija-vodovarstvenega-obmocja-izvira-radescice-2 | https://jknm.s3.eu-central-1.amazonaws.com/cistilna-akcija-vvo-izvira-radescice-ii-06-02-2024/vrelec_296_str_15.png | gone (2024, not mirrored) |
| 75 | Le kje sta Pihalnik in Achenloch? | https://jknm.org/le-kje-sta-pihalnik-in-achenloch | https://jknm.s3.eu-central-1.amazonaws.com/le-kje-sta-pihalnik-in-achenloch-03-06-2009/2577_pihalnik.pdf | no unique filename match |
| 107 | Podzemni vodovodarji [3] | https://jknm.org/podzemni-vodovodarji-3 | https://jknm.s3.eu-central-1.amazonaws.com/podzemni-vodovodarji-3-09-10-2009/4669_solnovo.pdf | no unique filename match |
| 500 | Cvingerska jama - raziskovanje nadaljevanja | https://jknm.org/cvingerska-jama-raziskovanje-nadaljevanja | https://jknm.s3.eu-central-1.amazonaws.com/cvingerska-jama-raziskovanje-nadaljevanja-09-11-2017/dk7_23_prsina_razkrita_skrivnost_jame_na_cvingerju.pdf | no unique filename match |

## Resolved pattern: `3631_cinkov_kriz.pdf`

The same file was referenced identically across three articles in the
"Iz klubskega arhiva: Brezno Cinkov križ" series (legacy_id 78, 79, 82).
None of the three resolved via the per-article fuzzy match (79 has no legacy
source at all; 78's and 82's legacy content each list 2 candidate paths where
the filename didn't match either uniquely) — but the file itself wasn't
actually lost: it's `served/media/pdf/3631_Cinkov_kriz.pdf`, still linked
live today from the static pages (zgodovina, raziskovanje) via the vsebina
bucket. `scripts/fix-cinkov-kriz-shared-pdf.ts` ingested it once into
gradivo and repointed all three articles at the same new url.
