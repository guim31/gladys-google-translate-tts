# Google Translate TTS

Da a Gladys la voz gratuita de **Google Traductor**: los anuncios de las
escenas se pronuncian con ella en sus altavoces. Sin cuenta ni clave de API,
como la síntesis de voz `google_translate` de Home Assistant (gTTS).

## Lo que obtiene

- Una **voz para Gladys** (Gladys 5.3.0 o posterior): una vez elegida, la
  acción de escena **Hablar en un altavoz** habla con Google Traductor
  en sus altavoces (Sonos, Google Cast, AirPlay…).
- Textos en **33 idiomas**, automáticamente en el idioma de cada usuario, con
  acentos regionales para el inglés, el francés, el español y el portugués, y
  una lectura lenta.
- Los textos largos (hasta los 2000 caracteres que envía Gladys) se cortan al
  final de las frases y se unen en un solo clip.

## Antes de empezar: qué es esta voz

- Es la voz del **sitio Google Traductor**, usada como gTTS lo hace desde hace
  años. **No es un servicio oficial de Google**: no hay garantía, y Google
  puede cambiarla, limitarla o detenerla en cualquier momento. La integración
  falla entonces de forma visible (Supervisión, registro de escenas), nunca
  cambia por sí sola a otra voz.
- **Cada texto pronunciado se envía a Google** (con la dirección IP de su
  conexión), según la
  [política de privacidad de Google](https://policies.google.com/privacy).
  No la use para textos que quiera mantener en casa.
- Se necesita una conexión a Internet.
- Sin relación con Google. Google Traductor es una marca de Google LLC.

## Configuración

1. Instale la integración desde el catálogo y abra su pestaña
   **Configuración**.
2. **Idioma de la voz**: **Automático** habla el idioma del usuario al que
   responde Gladys, y el del primer administrador para un anuncio de escena
   (francés si Gladys no lo conoce). O imponga un idioma.
3. **Acento**: una voz regional (inglés de Estados Unidos, del Reino Unido, de
   Australia o de la India; francés de Francia o de Canadá; español de España o
   de México; portugués de Brasil o de Portugal). Se usa cuando se habla su
   idioma; los demás idiomas conservan su voz habitual. La voz inglesa habitual
   es la británica.
4. **Lectura lenta**: habla más despacio, como el botón de lectura lenta de
   Google Traductor.
5. Guarde y pulse **Probar la voz**: se pide una frase de prueba a Google
   Traductor y se muestra la duración del clip recibido.
6. Abra **Integraciones → Inteligencia artificial** y elija **Google Translate
   TTS** en la tarjeta **Voz**.

## Uso en las escenas

Añada una acción **Hablar en un altavoz** a una escena, elija un
altavoz y escriba el texto. Gladys pide el clip a esta integración y lo sirve
al altavoz en su red local.

El asistente de voz de Gladys se queda en solo texto con una integración de
voz: su página funciona en HTTPS, y el clip se sirve en la red local en HTTP,
lo que el navegador bloquea. Es un límite de Gladys, igual para todas las
integraciones de voz.

## Límites

- Google Traductor admite **200 caracteres por solicitud**: un texto más largo
  se corta al final de las frases (luego de las cláusulas, luego de las
  palabras) y se pide **una parte cada vez**, unos 0,3 s cada una. Los 2000
  caracteres que Gladys envía como máximo suponen unas 12 solicitudes,
  4 segundos y un clip de 1,5 MB para 3 minutos: muy por debajo de los
  30 segundos que espera Gladys.
- Cada parte se lee con su propia entonación: un texto largo tiene breves
  pausas entre las partes.
- Un clip ya hecho (mismo texto, misma voz, misma velocidad) se guarda en
  memoria (los 16 últimos), y un anuncio en varios altavoces solo consulta a
  Google una vez.
- Cuando Google rechaza demasiadas solicitudes (HTTP 429), la integración
  espera al siguiente anuncio: no insiste.

## Solución de problemas

- La **Supervisión** indica si Google Traductor responde y, si no, por qué
  (sin Internet, demasiadas solicitudes, la voz gratuita ha cambiado…).
- Un anuncio fallido se escribe en los **registros** de la integración, y la
  acción de escena falla en el registro de escenas.
- «Puede que la voz gratuita haya cambiado»: Google ha modificado su sitio;
  busque una actualización de la integración.
- Inicie el contenedor con `LOG_LEVEL=debug` para ver cada solicitud.
