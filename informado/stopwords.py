"""Palabras vacías del español (sin tildes, como quedan tras normalizar) y términos periodísticos sin valor de tema."""

STOPWORDS = set("""
a al algo algun alguna algunas alguno algunos ambos ante antes aquel aquella aquellas aquellos aqui asi aun aunque
bajo bien cada casi como con contra cual cuales cualquier cuando cuanto cuantos de del desde donde dos durante
e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estaba estado estan estar estas este esto estos
fue fueron fui ha habia haber habra hace hacen hacer hacia han hasta hay he hoy la las le les lo los mas me mi mientras
mismo mucha muchas mucho muchos muy nada ni ningun ninguna no nos nosotros nuestra nuestro nuevo nueva nuevos nuevas o
otra otras otro otros para pero poco por porque primer primera puede pueden pues que quien quienes se sea sean segun
ser si sido siempre sin sobre solo son su sus tal tambien tampoco tan tanto te tenia tener tiene tienen toda todas
todo todos tras tu tus un una unas uno unos usted ya yo
dijo dice dijeron afirmo aseguro explico conto revelo hablo pidio confirmo anuncio advirtio sostuvo
asi cual cuales cuanto cuanta que como donde cuando
ano anos dia dias semana semanas mes meses hora horas vez veces parte forma caso tipo lugar
lunes martes miercoles jueves viernes sabado domingo
enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre
noticias noticia nota video videos foto fotos vivo minuto ultimo ultima ultimas hoy ayer manana
quien quienes cuanto cuanta cuantos cuantas
argentina argentino argentinos argentinas pais
""".split())

# Palabras clave de los sitemaps que no hablan del tema.
CLAVES_GENERICAS = {"edicion impresa", "video", "videos", "diario", "ultimas noticias", "politica", "economia",
                    "sociedad", "deportes", "el mundo", "internacionales", "opinion"}
