# 📋 Especificaciones: Wordsmith

> **Fase:** `/spec` (Especificación)
> **Estado:** En Definición / Validado
> **Última Revisión:** [Fecha]

---

## 🎯 1. Contexto y Objetivos
*Basado en la filosofía de "entender el problema antes de proponer la solución".*

- **Problema:** Crear un mundo 3D coherente actualmente requiere utilizar múltiples herramientas, conocimientos técnicos y procesos manuales. Un usuario puede generar imágenes, modelos 3D o escenarios con diferentes herramientas de IA, pero normalmente debe encargarse de decidir qué herramienta utilizar, generar cada elemento por separado, descargar los resultados y posteriormente integrarlos en una escena. Wordsmith busca eliminar esta barrera permitiendo que el usuario describa un mundo mediante un único prompt en lenguaje natural. El sistema será responsable de interpretar esa descripción, determinar qué elementos deben generarse y coordinar diferentes modelos de IA especializados en generación de mundos y assets 3D.
- **Objetivo (Éxito):** El usuario debe poder introducir un único prompt descriptivo y obtener automáticamente un pequeño mundo 3D coherente y explorable.
Ejemplo:"Crea una pequeña isla pirata abandonada después de una batalla, con un barco destruido en la playa, un fuerte en una colina, cofres de tesoro y un robot pirata." Wordsmith deberá: Interpretar la intención del usuario.
Identificar el entorno principal y los assets relevantes.
Generar el entorno mediante World Labs.
Generar assets específicos mediante Tripo.
Integrar los resultados.
Mostrar el resultado en una experiencia 3D interactiva.
Permitir explorar el mundo resultante sin necesidad de utilizar herramientas 3D profesionales.

El éxito del MVP se considerará alcanzado cuando un usuario pueda pasar de un prompt textual a una escena 3D navegable mediante un flujo prácticamente automático.

## 👥 2. Usuarios y Escenarios
*Identifica para quién construimos y en qué situaciones usarán el sistema.*

- **Perfil de Usuario:**

Usuario creativo o desarrollador que quiere crear rápidamente pequeños mundos 3D sin necesidad de dominar modelado 3D, motores gráficos o herramientas especializadas.

El sistema estará especialmente orientado a:

Creadores de contenido.
Diseñadores de juegos.
Artistas y prototipadores.
Desarrolladores.
Usuarios que quieran experimentar con generación de mundos mediante IA..
- **Escenarios Clave:**
  - Escenario A: El usuario introduce un prompt describiendo un mundo. Wordsmith analiza la descripción y determina automáticamente qué debe generar cada herramienta.
  - Escenario B: World Labs genera el entorno principal y Tripo genera personajes, objetos o elementos específicos identificados por el orquestador.
  - Escenario C: El sistema combina el entorno y los assets generados y presenta al usuario una escena 3D navegable.
  - Escenario D: El usuario puede explorar el resultado en un navegador mediante una experiencia 3D interactiva.
  - Escenario E: Cuando exista hardware compatible, el mismo mundo podrá visualizarse en una pantalla 3D/holográfica compatible, manteniendo la aplicación web como interfaz principal.

## ✨ 3. Funcionalidades Principales (Requisitos)
*El "Qué" del sistema. Estas tareas se trasladarán luego a `task.md`.*

**Generación de mundo mediante prompt:**

El usuario podrá introducir una descripción en lenguaje natural.

Criterio de aceptación: Un único prompt deberá iniciar el proceso de generación sin que el usuario tenga que seleccionar manualmente qué herramienta utilizar.

**Interpretación y descomposición del prompt:**

Un agente/orquestador analizará el prompt y producirá una especificación estructurada del mundo.

Criterio de aceptación: La especificación deberá distinguir al menos entre entorno, localizaciones relevantes y assets específicos.

**Generación del entorno mediante World Labs:**

El sistema utilizará World Labs para generar el escenario principal.

Criterio de aceptación: El resultado deberá ser un entorno 3D que pueda incorporarse a la experiencia de Wordsmith.

**Generación de assets mediante Tripo:**

El sistema utilizará Tripo para generar objetos, personajes u otros elementos identificados por el orquestador.

Criterio de aceptación: Al menos uno o varios assets generados deberán poder incorporarse posteriormente a la escena.

**Composición automática:**

Wordsmith deberá combinar el entorno generado y los assets seleccionados en una única experiencia.

Criterio de aceptación: El usuario deberá recibir una escena final sin necesidad de importar manualmente cada asset.

**Visualización 3D interactiva:**

El usuario podrá visualizar y recorrer el mundo generado desde el navegador.

Criterio de aceptación: La escena deberá permitir como mínimo movimiento/orbitación de cámara y exploración básica del entorno.

**Estado del proceso de generación:**

El sistema deberá mostrar el progreso de las diferentes generaciones debido al carácter asíncrono de las APIs.

Criterio de aceptación: El usuario deberá saber si el mundo está siendo analizado, generándose, integrándose o listo para explorar.

**Exportación/visualización compatible:**

El sistema deberá mantener los formatos de salida adecuados para permitir futuras integraciones con motores 3D o displays compatibles.

Criterio de aceptación: Los resultados deberán poder conservarse como assets reutilizables.

## 🏗️ 4. Propuesta de Solución Técnica (Resumen)
*Enlace directo con `ARCHITECTURE.md`.*

**Enfoque:**

Wordsmith será una aplicación web con una arquitectura cliente-servidor.

El frontend proporcionará la interfaz para introducir prompts y visualizar los mundos generados.

Un backend actuará como orquestador entre el usuario y los servicios de IA. El orquestador será responsable de transformar el prompt en una especificación estructurada y decidir qué tareas deben enviarse a cada servicio.

**Arquitectura conceptual:**

                       USUARIO
                          │
                          ▼
                  ┌───────────────┐
                  │   FRONTEND    │
                  │  Prompt + 3D  │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  ORQUESTADOR  │
                  │      IA       │
                  └───────┬───────┘
                          │
               ┌──────────┴──────────┐
               │                     │
               ▼                     ▼
        ┌─────────────┐       ┌─────────────┐
        │ WORLD LABS  │       │    TRIPO    │
        │   Mundo     │       │   Assets    │
        └──────┬──────┘       └──────┬──────┘
               │                     │
               └──────────┬──────────┘
                          ▼
                  ┌───────────────┐
                  │    WORLD      │
                  │   BUILDER     │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  THREE.JS /   │
                  │     SPARK     │
                  └───────┬───────┘
                          │
                          ▼
                   🌍 MUNDO 3D

El MVP priorizará una arquitectura web para facilitar el desarrollo, la demostración y la distribución del proyecto durante el hackathon.

**Dependencias Críticas:**
World Labs / Marble / World API.
Tripo API.
Modelo LLM para interpretación y orquestación del prompt.
Three.js para representación 3D.
Spark, cuando sea necesario para representar mundos generados por World Labs.
Node.js / TypeScript para el frontend.
Backend ligero para proteger API keys y gestionar las tareas asíncronas.
Hardware/display 3D compatible, únicamente como integración opcional del MVP.

**Oportunidades de Skills y MCPs:**

Se evaluará la creación de herramientas especializadas para el agente que permitan:

Interpretar prompts de creación de mundos.
Crear especificaciones estructuradas de mundos.
Solicitar generación de mundos a World Labs.
Solicitar generación de assets a Tripo.
Consultar el estado de tareas asíncronas.
Gestionar los assets generados.
Construir una escena a partir de los resultados.
Validar que los assets generados sean compatibles con la escena.

Un MCP local podría encapsular las operaciones de Tripo y World Labs para que el agente pueda utilizarlas como herramientas en lugar de gestionar directamente las llamadas HTTP.

También se podrán definir skills/ específicas para tareas como world-planning, asset-generation, scene-composition y world-validation.

**Sistema de Diseño:**

La interfaz deberá priorizar la simplicidad y la sensación de "crear mediante magia".

**Elementos principales:**

Campo de prompt como elemento central.
Botón de generación.
Estado/progreso de generación.
Visor 3D.
Información opcional sobre los elementos generados.
Controles mínimos de navegación.

La interfaz deberá evitar convertirse en un editor 3D complejo. Wordsmith debe sentirse principalmente como una herramienta de creación mediante lenguaje natural.

Los tokens y componentes definitivos se documentarán en docs/DESIGN.md.

### 4.1. Agent Readiness Checklist (Proyectos Web)
*Si la configuración de Agent Readiness (Web) está activa, documentar las tareas de descubrimiento e integración para agentes inteligentes:*
- [ ] **robots.txt**: Configurar con directiva `Content-Signal: ai-train=no, search=yes, ai-input=yes` y ruta al sitemap. Exponer el directorio del plugin.
- [ ] **llms.txt**: Crear mapa de contenidos en Markdown para agilizar la lectura semántica de la IA.
- [ ] **auth.md**: Describir los procesos de registro y acceso para los bots.
- [ ] **Metadatos en `.well-known/`**: Crear `api-catalog`, `oauth-protected-resource`, `oauth-authorization-server` y `http-message-signatures-directory`.
- [ ] **Agent Plugin**: Crear el paquete universal de herramientas y habilidades en `.well-known/agent-plugin/` (con manifiesto `plugin.json` y config `mcp.json` válidos según el estándar 1.0.0).
- [ ] **Negociación de Markdown y Links**: Configurar el enrutamiento para retornar texto plano Markdown con la cabecera `Accept: text/markdown` y definir la cabecera HTTP `Link` apuntando al plugin (`Link: </.well-known/agent-plugin/plugin.json>; rel="agent-plugin"; type="application/json"`).

## 🚫 5. Fuera de Alcance (Out of Scope)
*Vital para evitar el "scope creep" (crecimiento descontrolado del proyecto).*

Generación de mundos de gran escala tipo videojuego AAA.

Creación de mundos completamente persistentes y editables como un motor de videojuegos completo.

Editor 3D avanzado con herramientas de modelado, texturizado o animación manual.

Generación ilimitada de assets por prompt.

Multijugador en tiempo real.

Sistema de cuentas y perfiles de usuario completo.

Marketplace de mundos/assets.

Sistema económico o monetización.

Soporte para todos los motores gráficos existentes.

Integración obligatoria con Unreal Engine.

Compatibilidad con cualquier hardware holográfico existente.

Generación de personajes con IA conversacional avanzada.

Animaciones complejas generadas automáticamente.

Aplicación móvil nativa.

El MVP deberá centrarse en demostrar de forma convincente el flujo:

Prompt → IA → Mundo + Assets → Composición → Exploración 3D.

## ⚠️ 6. Riesgos y Mitigación
*Anticipar problemas es de ingenieros senior.*

- **Riesgo:** Las APIs de World Labs o Tripo pueden cambiar, tener límites de uso o presentar errores durante el hackathon.
  - **Mitigación:** Crear adaptadores independientes (WorldLabsProvider y TripoProvider) y centralizar las llamadas externas. Implementar reintentos, seguimiento de tareas y manejo explícito de errores.
- **Riesgo:** Los procesos de generación son asíncronos y pueden tardar demasiado para una experiencia interactiva.
  - **Mitigación:** Mostrar estados de progreso y permitir que el frontend consulte el estado de generación sin bloquear la aplicación.
- **Riesgo:** World Labs y Tripo generan resultados independientes que no encajan automáticamente.
  - **Mitigación:** Introducir una capa de composición propia que determine dónde y cómo incorporar los assets generados en el mundo.
- **Riesgo:** Los modelos generados por Tripo pueden no ser adecuados para integrarse directamente en el entorno.
  - **Mitigación:** Definir restricciones de generación, formatos soportados y una etapa de validación/conversión antes de incorporarlos a la escena.
- **Riesgo:** Coste elevado de créditos/API durante las pruebas.
  - **Mitigación:** Utilizar prompts de prueba controlados, cachear resultados, reutilizar assets y limitar las generaciones automáticas durante el desarrollo.
- **Riesgo:** Las API keys pueden quedar expuestas en el frontend.
  - **Mitigación:** Todas las claves privadas deberán permanecer en el backend. El frontend nunca deberá contener credenciales de World Labs o Tripo.
- **Riesgo:** El agente puede interpretar incorrectamente el prompt.
  - **Mitigación:** Utilizar una estructura JSON estricta para la especificación intermedia y validar el resultado antes de iniciar las generaciones.
- **Riesgo:** El mundo generado puede ser visualmente atractivo pero no suficientemente explorable/interactivo.
  - **Mitigación:** Definir desde el principio requisitos mínimos de navegación y validar cada generación mediante una experiencia 3D funcional.
- **Riesgo:** La integración con displays holográficos puede consumir demasiado tiempo.
  - **Mitigación:** Tratar la integración con hardware 3D como una capa adicional. El navegador convencional será siempre el fallback principal.

- **Riesgo de Seguridad y Privacidad (IA/Datos):**
Las API keys, prompts y resultados generados pueden contener información sensible o credenciales si el usuario introduce datos inadecuados.

  - **Mitigación:** Mantener secretos exclusivamente en variables de entorno, evitar registrar credenciales y aplicar validación de entradas. Añadir herramientas de detección de secretos en el repositorio.

- **Riesgo de Consumo de Contexto de IA / Mal Rastreo de Bots:**
El orquestador podría realizar demasiadas llamadas o generar una cantidad excesiva de assets a partir de prompts complejos.

  - **Mitigación:** Establecer límites explícitos de assets por generación, utilizar una especificación intermedia compacta y limitar el número de llamadas que puede realizar el agente.

## ❓ 7. Preguntas Abiertas
*Cosas que aún no sabemos o decisiones que dependen del usuario.*

**- ¿Qué modelo LLM utilizará el orquestador?**
Determinar si se utilizará un modelo externo mediante API o un modelo disponible dentro del stack del hackathon.

**- ¿Cómo se integrarán exactamente los assets de Tripo dentro de los mundos de World Labs?**
Esta es una de las decisiones técnicas más importantes del proyecto.

**- ¿Qué formato de salida utilizaremos como estándar interno?**
Evaluar GLB/glTF y otros formatos necesarios según las capacidades de World Labs, Tripo y Three.js/Spark.

**- ¿La composición será automática o parcialmente asistida?**
Determinar hasta qué punto el sistema colocará automáticamente los assets y hasta qué punto el usuario podrá intervenir.

**- ¿Qué tamaño máximo tendrá el mundo del MVP?**

**- ¿Cuántos assets generará como máximo cada prompt?**

**- ¿La integración con una pantalla holográfica será parte del MVP o una extensión de demostración?**

**- ¿Utilizaremos únicamente generación de assets estáticos o también personajes animados?**

**- ¿Necesitamos persistencia de mundos entre sesiones?**

**- ¿El mundo generado debe poder exportarse para utilizarlo posteriormente en Unreal/Unity/u otros motores?**

**- ¿Necesitamos soporte offline desde el primer día?**
No previsto para el MVP debido a la dependencia de servicios de generación externos.

## 🧪 8. Criterios de Evaluación y Evals (No Deterministas)
- **Métricas de Output:**

  - Coherencia semántica: El mundo generado debe representar razonablemente la intención descrita en el prompt.
  - Relevancia de assets: Los objetos generados por Tripo deben corresponder a los elementos identificados por el orquestador.
  - Coherencia visual: Los assets deben resultar razonablemente compatibles con el estilo y entorno del mundo.
  - Integración: Los assets deben aparecer correctamente dentro de la experiencia final.
  - Explorabilidad: El usuario debe poder recorrer/interactuar con el resultado sin errores graves.
  - Validez técnica: Los assets y mundos deben poder cargarse sin errores en el visor 3D.
  - Conformidad estructural: La salida del orquestador debe respetar el esquema JSON definido.

- **Métricas de Trayectoria:**

  - Número de llamadas a World Labs por generación.
  - Número de llamadas a Tripo por generación.
  - Número total de assets generados por prompt.
  - Tiempo desde el prompt hasta el mundo explorable.
  - Porcentaje de generaciones completadas correctamente.
  - Número de reintentos necesarios.
  - Consumo de créditos por generación.
  - Número de decisiones tomadas automáticamente por el orquestador.
  - Porcentaje de tareas que requieren intervención manual.

- **Evaluación humana:**

  - Para una muestra de prompts predefinidos, evaluar:

    - ¿El resultado corresponde a lo que pidió el usuario?
    - ¿El mundo resulta visualmente coherente?
    - ¿Los assets aparecen en lugares razonables?
    - ¿El resultado se siente como un mundo y no como una colección de modelos?
    - ¿El proceso requiere intervención manual?
    - ¿El usuario entiende qué está ocurriendo durante la generación?
    - ¿La experiencia final resulta suficientemente atractiva para una demostración de hackathon?

**🏆 Criterio global de éxito del MVP**

Wordsmith será considerado funcional cuando pueda demostrar de forma reproducible el siguiente flujo:

                    ✍️ PROMPT
                       │
                       ▼
                🧠 INTERPRETACIÓN
                       │
                       ▼
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
        🌍 WORLD LABS         🧩 TRIPO
         genera mundo       genera assets
              │                 │
              └────────┬────────┘
                       ▼
                 🏗️ COMPOSICIÓN
                       │
                       ▼
                 🌍 MUNDO 3D
                       │
                       ▼
               👤 EXPLORACIÓN
                       │
                       ▼
              🔮 DISPLAY 3D
               (opcional)

El objetivo no es demostrar que una IA puede generar un modelo 3D.

El objetivo es demostrar que Wordsmith puede actuar como un director de creación capaz de convertir una intención expresada en lenguaje natural en un pequeño mundo 3D compuesto automáticamente a partir de diferentes herramientas de IA.

---
**Instrucción para la IA:** No pases a la fase `/plan` hasta que las "Preguntas Abiertas" críticas hayan sido resueltas o tengan un camino de solución definido.