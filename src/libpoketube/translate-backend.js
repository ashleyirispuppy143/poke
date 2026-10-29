/**
 * Poke is a Free/Libre YouTube front-end!
 *
 * See the GNU GPL license text here:
 * https://www.gnu.org/licenses/gpl-3.0.txt
 *
 * Please do not remove this notice when redistributing this file!
 */
async function translate(text, from = "auto", to = "en") {
  let translatedText = "";
  let pronunciation = "";
  const definitions = {};
  const translations = {};
  let detectedSourceLanguage = from || "auto";

  if (!text) {
    return {
      translatedText,
      pronunciation,
      definitions,
      translations,
      sourceLanguage: ""
    };
  }

  const { fetch } = await import("undici");

  const endpoint = "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute?rpcids=MkEWBc&rt=c";
  const reqJSON = [[text, detectedSourceLanguage, to || "en", true], [null]];
  const reqPayload = [[["MkEWBc", JSON.stringify(reqJSON), null, "generic"]]];
  const body = "f.req=" + encodeURIComponent(JSON.stringify(reqPayload));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body
  });

  const responseText = await response.text();
  const match = responseText.match(/\n\d+\n(.*)\n\d+\n/);

  if (match?.[1]) {
    const raw = JSON.parse(match[1]);
    const data = raw?.[0]?.[2];

    if (data) {
      const json_ = JSON.parse(data);

      const variant = json_?.[1]?.[0]?.[0];
      if (Array.isArray(variant)) {
        if (Array.isArray(variant[5])) {
          for (const segment of variant[5]) {
            if (segment?.[2] === true && translatedText !== "") {
              translatedText += " ";
            }
            if (segment?.[0]) {
              translatedText += segment[0];
            }
          }
        } else if (variant[0] != null) {
          translatedText = variant[0];
        }
      }

      if (json_?.[0]?.[2] != null) detectedSourceLanguage = json_[0][2];
      if (json_?.[1]?.[0]?.[0]?.[1] != null) pronunciation = json_[1][0][0][1];

      const defGroups = json_?.[3]?.[1]?.[0];
      if (Array.isArray(defGroups)) {
        for (const group of defGroups) {
          if (Array.isArray(group) && group.length > 0) {
            const defType = group[0] ?? "unknown";
            definitions[defType] = [];

            if (Array.isArray(group[1])) {
              for (const defBox of group[1]) {
                const entry = {};
                if (defBox?.[4]?.[0]?.[0] != null) entry.dictionary = defBox[4][0][0];
                if (defBox?.[0] != null) entry.definition = defBox[0];
                if (defBox?.[1] != null) entry.use_in_sentence = defBox[1];

                if (Array.isArray(defBox?.[5])) {
                  const synonymsMap = {};
                  for (const synBox of defBox[5]) {
                    const synType = synBox?.[1]?.[0]?.[0] ?? "";
                    if (Array.isArray(synBox?.[0])) {
                      synonymsMap[synType] = synBox[0].map(w => w?.[0]).filter(Boolean);
                    }
                  }
                  entry.synonyms = synonymsMap;
                }
                definitions[defType].push(entry);
              }
            }
          }
        }
      }

      const transBox = json_?.[3]?.[5]?.[0];
      if (Array.isArray(transBox)) {
        for (const box of transBox) {
          if (Array.isArray(box) && box.length > 0) {
            const transType = box[0] ?? "unknown";
            translations[transType] = {};

            if (Array.isArray(box[1])) {
              for (const item of box[1]) {
                const name = item?.[0];
                if (name != null) {
                  translations[transType][name] = {};
                  if (item?.[3] != null) {
                    let freq = String(Math.trunc(Number(item[3])));
                    if (freq === "3") freq = "1";
                    else if (freq === "1") freq = "3";

                    translations[transType][name].frequency = `${freq}/3`;
                    translations[transType][name].words = Array.isArray(item[2]) ? item[2] : [];
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    translatedText,
    pronunciation,
    definitions,
    translations,
    sourceLanguage: detectedSourceLanguage === "auto" ? "" : detectedSourceLanguage
  };
}

function getTtsUrl(text, lang = "en") {
  const requestURL = new URL("https://translate.google.com/translate_tts");
  requestURL.searchParams.append("tl", lang);
  requestURL.searchParams.append("q", text);
  requestURL.searchParams.append("client", "tw-ob");
  return requestURL.toString();
}

module.exports = {
  translate,
  getTtsUrl
};