"use server";
import { XMLParser } from "fast-xml-parser";
import path from "path";
import fs_promises from "node:fs/promises";
import { PublishedArticleWithAuthors } from "./converter-server";
import { ImportedArticle } from "./converter-spaghetti";

/* 
{
  ID: 1,
  Kategorija: 1,
  Jezik: 'SI',
  Naslov: 'Potop v termalni izvir',
  Povzetek: 'V Dolenjskih Toplicah so se med gradnjo prizidka k hotelu Kristal v steni gradbene jame odprle tri razpoke, dno katerih je bilo zalito s termalno vodo. Jamarji smo si lokacijo ogledali in ugotovili, da gre za gladke ozke razpoke v primarni kamnini. Srednja se odpira vse do površja, vendar na površino ne seže, ker je njen vrh zabit z 1,5 m debelim ilovnatim čepom. Na dnu vseh treh razpok se je kazala termalna voda z ocenjeno temperaturo nad 30 stopinj C. Ocenili smo, da srednja razpoka dopušča vstop v potopljene rove. Iz jame je sicer termalna voda prvotno tekla proti nižjim delom gradbene jame, kasneje pa so gradbinci s potopnimi črpalkami njen nivo znižali za približno en meter.',
  Tekst: '<p>V Dolenjskih Toplicah so se med gradnjo prizidka k hotelu Kristal v steni gradbene jame odprle tri razpoke, dno katerih je bilo zalito s termalno vodo. Jamarji smo si lokacijo ogledali in ugotovili, da gre za gladke ozke razpoke v primarni kamnini. Srednja se odpira vse do površja, vendar na površino ne seže, ker je njen vrh zabit z 1,5 m debelim ilovnatim čepom. Na dnu vseh treh razpok se je kazala termalna voda z ocenjeno temperaturo nad 30 stopinj C. Ocenili smo, da srednja razpoka dopušča vstop v potopljene rove. Iz jame je sicer termalna voda prvotno tekla proti nižjim delom gradbene jame, kasneje pa so gradbinci s potopnimi črpalkami njen nivo znižali za približno en meter. </p>\n' +
    '<p>Po pogovorih z investitorjem, vodjo gradbišča in direktorjem Term Dolenjske Toplice smo se dogovorili za jamski potop. Morebitna odkritja novih potopljenih rovov, njihove dimenzije ter podzemne smeri, bi bila dobrodošla podpora gradbenikom in investitorjem pri odločitvah, kako v gradbeno-tehničnem smislu sanirati nastalo situacijo. </p>\n' +
    '<p>Jamski potop smo opravili v nedeljo, 27. januarja 2008 ob 14. uri. Ob našem obisku je bilo v gradbeni jami od 20 - 50 cm globoko jezero ohlajene termalne vode, ker se je nepredvidemo ustavilo prečrpavanje vode iz gradbene jame v meteorno kanalizacijo. Leva razpoka je bila za potapljača z opremo preozka, desna premalo izrazita in nevarna zaradi zagozdenih skal nad razpoko. Izkušeni jamski potapljač Uroš Ilič se je zato potopil v srednjo razpoko. Zakaljena voda mu je oteževala pregled rova, zato je morebitno nadaljevanje iskal zgolj s tipanjem z rokama. Žal se je v prvem potopu v dolžino prebil samo za 3 in v globino za 4 m. S ponovnim potopom je zgolj potrdil prvotno ugotovitev, da so ožine v notranjosti za potapljača neprehodne. Leva in srednja razpoka sta pod gladino sicer povezani, a prehod potapljača zaradi ožin ni možen. Voda v razpoki je bila zaradi mešanja z ohlajeno vodo iz gradbene jame (zunanja temperatura je bila 7 stopinj C) bistveno hladnejša kot pri našem prvem obisku. </p>\n' +
    '<p>V dnu gradbene jame je sicer kakšen ducat manjših izvirov, iz katerih na površje sili termalna voda. Po informacijah gradbincev ima večinoma 36 stopinj, enako kot v zdraviliških vrelcih. Samo predstavljamo si lahko, kakšna odkritjo bi nas pričakalo, če bi bila gradbena jama za meter ali dva globlja ... </p>\n' +
    '<p>Udeleženci: Uroš Ilič, Darko Hribar (JK Krka) in Marko Pršina (JK Novo mesto) </p>\n' +
    '<p><strong>Marko Pršina</strong></p>\n' +
    '<div class="slika450"><img src="/media/img/novice/2008/01/1_gradbena%20jama.jpg" alt="" width="450" height="300" />\n' +
    '<p>Gradbena jama. </p>\n' +
    '</div>\n' +
    '<div class="slika450"><img src="/media/img/novice/2008/01/2_razpoki_v_steni.jpg" alt="" width="450" height="300" />\n' +
    '<p>Razpoki v steni. </p>\n' +
    '</div>\n' +
    '<div class="slika450"><img src="/media/img/novice/2008/01/3_uros_iz_jame.jpg" alt="" width="450" height="300" />\n' +
    '<p>Uroš iz jame. </p>\n' +
    '</div>\n' +
    '<div class="slika450"><img src="/media/img/novice/2008/01/4_uros_po_potopu.jpg" alt="" width="450" height="300" />\n' +
    '<p>Uroš po potopu. </p>\n' +
    '</div>',
  Datum1: '2008-02-29T00:00:00',
  Objavi: -1,
  Vnasalec: 0,
  ZadnjaSprememba: '2014-11-19T10:27:17'
}
   */
type ObjaveType = {
  ID: string;
  Kategorija: string;
  Jezik: string;
  Naslov: string;
  Povzetek: string;
  Tekst: string;
  Datum1: string;
  Objavi: string;
  Vnasalec: string;
  ZadnjaSprememba: string;
};

type XMLType = {
  "?xml": string;
  dataroot: {
    Objave: ObjaveType[];
  };
};

export async function read_from_xml() {
  const imported_articles: ImportedArticle[] = [];

  const objave_path = path.join(process.cwd(), "src/assets/Objave.xml");
  const objave_string = await fs_promises.readFile(objave_path, "utf8");
  const parser = new XMLParser();
  const objave = parser.parse(objave_string) as XMLType;

  for (const objava of objave.dataroot.Objave) {
    imported_articles.push({
      objave_id: parseInt(objava.ID),
      title: objava.Naslov,
      content: objava.Tekst,
      created_at: objava.Datum1,
      updated_at: objava.ZadnjaSprememba,
    });
  }

  // console.log(csv_articles.find((a) => a.id == "40")?.content);

  return imported_articles;
}
