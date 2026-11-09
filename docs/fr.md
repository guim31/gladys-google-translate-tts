# Google Translate TTS

Donne à Gladys la voix gratuite de **Google Traduction** : les annonces des
scènes sont prononcées par elle sur vos enceintes. Sans compte ni clé d'API,
comme la synthèse vocale `google_translate` de Home Assistant (gTTS).

## Ce que vous obtenez

- Une **voix pour Gladys** (Gladys 5.3.0 ou plus récent) : une fois choisie,
  l'action de scène **Parler sur une enceinte** parle avec Google Traduction sur
  vos enceintes (Sonos, Google Cast, AirPlay…).
- Des textes en **33 langues**, automatiquement dans la langue de chaque
  utilisateur, avec des accents régionaux pour l'anglais, le français,
  l'espagnol et le portugais, et une lecture lente.
- Les textes longs (jusqu'aux 2 000 caractères que Gladys envoie) sont coupés
  en fin de phrase et réunis en un seul clip.

## Avant de commencer : ce qu'est cette voix

- C'est la voix du **site Google Traduction**, utilisée comme gTTS le fait
  depuis des années. Ce **n'est pas un service officiel de Google** : aucune
  garantie, et Google peut la changer, la limiter ou l'arrêter à tout moment.
  L'intégration échoue alors de façon visible (Supervision, journal des
  scènes), elle ne bascule jamais d'elle-même sur une autre voix.
- **Chaque texte prononcé est envoyé à Google** (avec l'adresse IP de votre
  connexion), selon les
  [règles de confidentialité de Google](https://policies.google.com/privacy).
  Ne l'utilisez pas pour des textes que vous voulez garder chez vous.
- Une connexion Internet est nécessaire.
- Sans lien avec Google. Google Traduction est une marque de Google LLC.

## Configuration

1. Installez l'intégration depuis le catalogue, puis ouvrez son onglet
   **Configuration**.
2. **Langue de la voix** : **Automatique** parle la langue de l'utilisateur à
   qui Gladys répond, et celle du premier administrateur pour une annonce de
   scène (le français si Gladys ne la connaît pas). Ou imposez une langue.
3. **Accent** : une voix régionale (anglais des États-Unis, du Royaume-Uni,
   d'Australie ou d'Inde ; français de France ou du Canada ; espagnol
   d'Espagne ou du Mexique ; portugais du Brésil ou du Portugal). Elle sert
   quand la langue parlée est la sienne ; les autres langues gardent leur voix
   habituelle. La voix anglaise habituelle est la britannique.
4. **Lecture lente** : parle plus lentement, comme le bouton de lecture lente
   de Google Traduction.
5. Enregistrez, puis appuyez sur **Tester la voix** : une phrase de test est
   demandée à Google Traduction et la durée du clip reçu s'affiche.
6. Ouvrez **Intégrations → Intelligence Artificielle** et choisissez **Google
   Translate TTS** dans la carte **Voix**.

## Utilisation dans les scènes

Ajoutez une action **Parler sur une enceinte** à une scène, choisissez une
enceinte et saisissez le texte. Gladys demande le clip à cette intégration,
puis le sert à l'enceinte sur votre réseau local.

L'assistant vocal de Gladys reste en texte seul avec une intégration de voix :
sa page tourne en HTTPS, et le clip est servi sur le réseau local en HTTP, ce
que le navigateur bloque. C'est une limite de Gladys, la même pour toutes les
intégrations de voix.

## Limites

- Google Traduction accepte **200 caractères par requête** : un texte plus long
  est coupé en fin de phrase (puis de proposition, puis de mot) et demandé
  **une partie à la fois**, environ 0,3 s chacune. Les 2 000 caractères que
  Gladys envoie au plus font environ 12 requêtes, 4 secondes et un clip de
  1,5 Mo pour 3 minutes : bien en deçà des 30 secondes que Gladys attend.
- Chaque partie est lue avec sa propre intonation : un texte long a de courtes
  pauses entre les parties.
- Un clip déjà fait (même texte, même voix, même vitesse) est gardé en mémoire
  (les 16 derniers), et une annonce sur plusieurs enceintes ne sollicite Google
  qu'une fois.
- Quand Google refuse trop de requêtes (HTTP 429), l'intégration attend
  l'annonce suivante : elle n'insiste pas.

## Dépannage

- La **Supervision** indique si Google Traduction répond et, sinon, pourquoi
  (pas d'Internet, trop de requêtes, la voix gratuite a changé…).
- Une annonce en échec est écrite dans les **journaux** de l'intégration, et
  l'action de scène échoue dans le journal des scènes.
- « La voix gratuite a peut-être changé » : Google a modifié son site ;
  cherchez une mise à jour de l'intégration.
- Démarrez le conteneur avec `LOG_LEVEL=debug` pour voir chaque requête.
