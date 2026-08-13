# FIUNI Correlativas

Una interfaz alternativa al sistema integral de la Facultad de Ingeniería de la Universidad Nacional de Itapúa (FIUNI), pensada principalmente para encontrar las correlativas de las materias de una manera sencilla y rápida. 

En vez de una lista plana de materias, este proyecto arma una interfaz más interactiva con colores indicando qué se puede cursar y qué todavía depende de otras materias, notas y materias habilitadas para examenes, además de sumar funciones que el sistema oficial no tiene.

## Funcionalidades

- **'Mapa' de correlativas**: relaciona todas las materias del plan de estudio, para identificar de forma inmediata qué se puede cursar según lo que ya se ha aprobado.
- **Libreta de calificaciones**: seguimiento centralizado de notas por materia.
- **Calculadora de notas**: estimación de promedios y notas necesarias en el examen final.
- **Calendario académico**: fechas y actividades importantes.
- **Interfaz cuidada**: más detalle visual y mejor experiencia de uso.
- **Modo claro / oscuro**.  
  
## Motivación

El sistema oficial de la facultad no expone una API pública ni documentada. Este proyecto nació de ir probando y mapeando sus endpoints manualmente hasta entender su funcionamiento, y a partir de eso se construyó un servidor propio (hosteado en Render) que sirve de puente entre esos datos y esta interfaz.

## Stack

- React + Vite
- Servidor propio (Python) desplegado en Render

## Acceso y colaboración

Este proyecto es de uso exclusivo para estudiantes y personal de FIUNI. El repositorio es público con fines de transparencia y consulta del código, pero no se aceptan colaboraciones externas sin autorización previa.

## Licencia

Todos los derechos reservados. Ver [LICENSE](./LICENSE) para más detalles.