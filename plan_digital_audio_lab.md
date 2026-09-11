# Plan de Aplicación: Digital Audio Lab

## Objetivo

Crear una aplicación web educativa e interactiva para explicar de forma clara y visual dos conceptos fundamentales del audio digital:

1. **Frecuencia de muestreo**
2. **Profundidad de bits**

La aplicación estará dirigida a estudiantes de un curso básico de sonido y permitirá modificar valores mediante sliders, botones o campos numéricos para observar en tiempo real cómo cambia la representación digital de una señal.

La idea central será:

> **Frecuencia de muestreo = cuántas veces medimos la señal.**  
> **Profundidad de bits = qué tan precisa es cada medición.**

---

# 1. Estructura general

La aplicación tendrá únicamente dos pestañas principales:

- **Frecuencia de muestreo**
- **Profundidad de bits**

Ambas utilizarán como referencia una misma señal analógica, inicialmente una onda senoidal.

Esto permitirá explicar que ambos conceptos forman parte del mismo proceso de conversión analógico-digital, pero afectan dimensiones diferentes.

---

# 2. Diseño general de la interfaz

```text
┌──────────────────────────────────────────────┐
│            DIGITAL AUDIO LAB                 │
│  Aprende cómo el sonido se convierte        │
│  en información digital                     │
│                                              │
│ [ Frecuencia de muestreo ] [ Profundidad ]  │
├──────────────────────────────────────────────┤
│                                              │
│             GRÁFICO INTERACTIVO              │
│                                              │
│     ~~~~~~~~ señal analógica ~~~~~~~~        │
│      •   •   •   •   •   •   •             │
│                                              │
├─────────────────────┬────────────────────────┤
│ CONTROLES           │ ¿QUÉ ESTÁ PASANDO?    │
│                     │                        │
│ Slider              │ Explicación sencilla  │
│ Valor numérico      │ que cambia según      │
│ Presets             │ los controles.        │
└─────────────────────┴────────────────────────┘
```

La interfaz debe priorizar:

- claridad;
- pocos controles;
- gráficos grandes;
- texto explicativo corto;
- respuesta visual inmediata.

---

# 3. Tab 1 — Frecuencia de muestreo

## Objetivo

Mostrar visualmente cuántas veces se mide una señal por segundo y cómo la cantidad de muestras afecta la representación de una onda.

La pregunta principal será:

> **¿Cuántas veces por segundo estamos midiendo la señal?**

---

## 3.1 Gráfico principal

El gráfico mostrará simultáneamente:

1. **Señal analógica original**
2. **Puntos de muestreo**
3. **Representación digital o reconstrucción aproximada**

Ejemplo:

```text
Señal original

        ╭───╮
       ╱     ╲
──────╯       ╰──────


Muestras

        ●
       / \
   ●  /   \  ●
─────/─────\─────
 ●           ●
```

Al disminuir el número de muestras, debe ser evidente que el sistema tiene menos información sobre la señal.

---

# 4. Controles de frecuencia de muestreo

## Slider: Sample Rate

Para propósitos educativos se utilizarán primero valores muy bajos.

Ejemplo:

```text
4 Hz ───── 8 Hz ───── 16 Hz ───── 32 Hz
```

Luego se podrán incluir valores reales:

- 22.05 kHz
- 44.1 kHz
- 48 kHz
- 88.2 kHz
- 96 kHz
- 192 kHz

Se recomienda separar los valores en dos modos:

### Modo demostración

- 4 Hz
- 8 Hz
- 12 Hz
- 16 Hz
- 20 Hz
- 40 Hz

### Valores reales

- 44.1 kHz
- 48 kHz
- 88.2 kHz
- 96 kHz
- 192 kHz

Los valores bajos permiten visualizar claramente las muestras.

---

# 5. Control de frecuencia de la señal

Agregar un segundo slider:

```text
Frecuencia de la onda

1 Hz ───────────●──────────── 20 Hz
```

Esto permitirá comparar la frecuencia de la señal con la frecuencia de muestreo.

Ejemplo:

```text
Señal: 5 Hz
Sample Rate: 20 Hz

✓ La señal puede representarse correctamente.
```

Otro ejemplo:

```text
Señal: 10 Hz
Sample Rate: 12 Hz

⚠ Frecuencia de muestreo insuficiente.
Puede producirse aliasing.
```

---

# 6. Teorema de Nyquist

La aplicación debe explicar visualmente:

> Para representar correctamente una frecuencia necesitamos una frecuencia de muestreo superior al doble de la frecuencia de la señal.

Mostrar la fórmula:

```text
Frecuencia máxima ≈ Sample Rate / 2
```

Ejemplos:

| Sample Rate | Frecuencia máxima teórica |
|---|---:|
| 44.1 kHz | 22.05 kHz |
| 48 kHz | 24 kHz |
| 96 kHz | 48 kHz |

---

# 7. Indicadores del Tab 1

Mostrar un panel pequeño con:

```text
Señal
5 kHz

Sample Rate
48 kHz

Nyquist
24 kHz

Estado
✓ Puede representarse
```

El texto debe cambiar automáticamente según los controles.

Ejemplo:

> Estás tomando 48.000 muestras por segundo. Según Nyquist, este sistema puede representar frecuencias de hasta aproximadamente 24 kHz.

---

# 8. Switch: Mostrar Nyquist

Agregar un interruptor:

```text
[✓] Mostrar límite de Nyquist
```

Visualmente:

```text
Sample Rate
48 kHz

        ÷ 2
         ↓

Nyquist
24 kHz
```

---

# 9. Visualización del aliasing

Una función educativa importante será permitir que el estudiante lleve la frecuencia de la señal por encima del límite de Nyquist.

Ejemplo:

```text
Frecuencia de señal: 15 Hz
Sample Rate: 20 Hz
Nyquist: 10 Hz
```

La aplicación debe mostrar:

```text
⚠ ALIASING

La frecuencia de la señal supera el límite de Nyquist.
La señal digital puede representar una frecuencia diferente de la original.
```

El gráfico deberá hacer visible la diferencia entre:

- señal original;
- puntos muestreados;
- señal aparente reconstruida.

---

# 10. Tab 2 — Profundidad de bits

## Objetivo

Mostrar qué tan precisa puede ser cada medición de amplitud.

La pregunta principal será:

> **¿Con qué precisión estamos midiendo la amplitud?**

En este tab la frecuencia de muestreo puede mantenerse fija.

Ejemplo:

```text
Sample Rate fijo: 48 kHz
```

---

# 11. Control de Bit Depth

Slider con:

- 2 bits
- 3 bits
- 4 bits
- 8 bits
- 16 bits
- 24 bits

Aunque 2, 3 y 4 bits no sean profundidades habituales en producción profesional, son ideales para demostrar visualmente la cuantización.

Ejemplo:

```text
2 bits ─────●────────────── 24 bits
```

---

# 12. Niveles posibles

Mostrar automáticamente:

```text
Niveles = 2^bits
```

Ejemplos:

| Bits | Niveles posibles |
|---:|---:|
| 2 | 4 |
| 3 | 8 |
| 4 | 16 |
| 8 | 256 |
| 16 | 65.536 |
| 24 | 16.777.216 |

---

# 13. Visualización de cuantización

La señal analógica debe aparecer detrás.

Sobre ella se mostrará la versión cuantizada.

Ejemplo conceptual:

```text
Señal original
      ╭────╮
    ╭─╯    ╰─╮
────╯        ╰────


Señal cuantizada
      ┌────┐
   ┌──┘    └──┐
───┘          └───
```

Con pocos bits deben observarse escalones grandes.

Con más bits, los escalones deben hacerse mucho más pequeños.

---

# 14. Cuantización con 2 bits

Ejemplo:

```text
2 bits = 4 niveles posibles
```

Visualmente:

```text
+1 ─────────────────────

       ●       ●
    ●             ●

 0 ─────────────────────

         ●   ●

-1 ─────────────────────
```

Al aumentar a 3 bits:

```text
3 bits = 8 niveles
```

Luego:

```text
4 bits = 16 niveles
```

La diferencia visual debe ser inmediata.

---

# 15. Indicadores del Tab 2

Mostrar:

```text
BIT DEPTH
24 bits

NIVELES DISPONIBLES
16.777.216

RANGO DINÁMICO TEÓRICO
≈ 144 dB

ERROR DE CUANTIZACIÓN
Muy bajo
```

---

# 16. Rango dinámico

Mostrar como regla sencilla:

```text
Rango dinámico ≈ 6.02 × bits
```

Valores aproximados:

| Profundidad | Rango dinámico teórico |
|---|---:|
| 8 bits | 48 dB |
| 16 bits | 96 dB |
| 24 bits | 144 dB |

Para el curso básico puede simplificarse como:

> Cada bit adicional aporta aproximadamente 6 dB de rango dinámico.

---

# 17. Comparación A/B

Agregar una opción educativa:

```text
COMPARAR

[A] 4 bits
[B] 16 bits
```

Mostrar ambas señales simultáneamente.

Ejemplo:

```text
4 BITS

      ┌──┐
   ┌──┘  └──┐
───┘        └───


16 BITS

      ╭──╮
    ╭─╯  ╰─╮
────╯      ╰────
```

Esto debe ayudar a visualizar rápidamente la diferencia en resolución vertical.

---

# 18. Relación visual entre ambos conceptos

La aplicación debe mostrar de forma constante la relación:

```text
                 AMPLITUD
                    ↑
                    │
BIT DEPTH ──────────│
                    │
                    └────────────→ TIEMPO
                              SAMPLE RATE
```

Conceptualmente:

## Sample Rate

Trabaja principalmente sobre el eje horizontal.

```text
Tiempo → ¿Con qué frecuencia medimos?
```

## Bit Depth

Trabaja principalmente sobre el eje vertical.

```text
Amplitud → ¿Con qué precisión medimos?
```

---

# 19. Presets

## Frecuencia de muestreo

Agregar botones:

```text
[ Muy bajo ]
[ CD 44.1 kHz ]
[ Video 48 kHz ]
[ Hi-Res 96 kHz ]
```

Al seleccionar cada preset debe aparecer una breve descripción.

Ejemplo:

### 48 kHz

> Frecuencia de muestreo muy utilizada en producción audiovisual y audio profesional.

---

## Profundidad de bits

Agregar:

```text
[ 4-bit Demo ]
[ 8-bit ]
[ CD 16-bit ]
[ Studio 24-bit ]
```

Ejemplo para 24 bits:

> 24 bits es una profundidad habitual durante grabación y producción porque proporciona un amplio rango dinámico y permite trabajar cómodamente con headroom.

---

# 20. Modo presentación

Agregar un botón:

```text
Modo presentación
```

Al activarlo:

- aumentar tamaño del gráfico;
- aumentar tamaño de sliders;
- aumentar tipografía;
- ocultar información secundaria;
- dejar visibles solamente los conceptos esenciales.

La idea es poder utilizar la aplicación proyectada frente a una clase.

---

# 21. Flujo de exposición sugerido

## Paso 1

Mostrar una onda senoidal.

Preguntar:

> ¿Cómo hacemos para guardar esta señal continua dentro de un computador?

---

## Paso 2

Abrir el tab **Frecuencia de muestreo**.

Comenzar con pocas muestras.

Ejemplo:

```text
8 muestras por segundo
```

Luego aumentar progresivamente.

---

## Paso 3

Explicar:

> La frecuencia de muestreo nos dice cuántas veces medimos la señal cada segundo.

---

## Paso 4

Modificar la frecuencia de la señal hasta superar Nyquist.

Mostrar aliasing.

Explicar:

> Si no tomamos suficientes muestras, podemos interpretar incorrectamente la frecuencia original.

---

## Paso 5

Cambiar al tab **Profundidad de bits**.

Explicar:

> Ahora no vamos a cambiar cuántas veces medimos. Vamos a cambiar qué tan precisa es cada medición.

---

## Paso 6

Comenzar con 2 bits.

Mostrar los cuatro niveles posibles.

Subir progresivamente hasta 8, 16 y 24 bits.

---

## Paso 7

Finalizar mostrando:

```text
Sample Rate
¿Cuántas veces medimos?

Bit Depth
¿Qué tan precisa es cada medición?
```

---

# 22. Arquitectura técnica

La aplicación puede construirse completamente en frontend.

Tecnologías recomendadas:

- React
- TypeScript
- Vite
- SVG
- CSS o Tailwind CSS

No requiere backend.

---

# 23. Estructura de componentes

```text
App
│
├── Header
│
├── ConceptTabs
│
├── SamplingRateDemo
│   ├── WaveformChart
│   ├── OriginalWave
│   ├── SamplePoints
│   ├── ReconstructedWave
│   ├── SamplingControls
│   ├── NyquistIndicator
│   └── ExplanationPanel
│
└── BitDepthDemo
    ├── WaveformChart
    ├── OriginalWave
    ├── QuantizedWave
    ├── QuantizationLevels
    ├── BitDepthControls
    ├── DynamicRangeIndicator
    └── ExplanationPanel
```

---

# 24. Modelo matemático

## Señal

Utilizar inicialmente una onda senoidal:

```text
y(t) = A × sin(2πft)
```

Donde:

- `A` = amplitud;
- `f` = frecuencia;
- `t` = tiempo.

---

# 25. Muestreo

Intervalo entre muestras:

```text
sampleInterval = 1 / sampleRate
```

Las muestras pueden calcularse mediante:

```text
y[n] = sin(2πf × n / sampleRate)
```

---

# 26. Cuantización

Número de niveles:

```text
levels = 2^bits
```

Cada muestra debe aproximarse matemáticamente al nivel disponible más cercano.

De esta forma, el gráfico mostrará una simulación real de la cuantización y no simplemente una ilustración arbitraria.

---

# 27. MVP

La primera versión debe incluir únicamente lo esencial.

## Funcionalidades

1. Dos tabs:
   - Frecuencia de muestreo
   - Profundidad de bits

2. Onda senoidal común.

3. Slider de frecuencia de la señal.

4. Slider de Sample Rate.

5. Visualización de muestras.

6. Indicador de Nyquist.

7. Advertencia de aliasing.

8. Slider de Bit Depth.

9. Visualización de niveles de cuantización.

10. Cálculo de:

```text
2^bits
```

11. Cálculo aproximado de rango dinámico.

12. Presets de Sample Rate.

13. Presets de Bit Depth.

14. Explicación dinámica de lo que está ocurriendo.

15. Modo presentación.

---

# 28. Segunda versión

Después del MVP se pueden incorporar funciones adicionales.

## Audio interactivo

Permitir reproducir una señal para escuchar:

- señal original;
- señal con bajo sample rate;
- aliasing;
- señal con baja profundidad de bits;
- ruido de cuantización.

Agregar botones:

```text
▶ Original
▶ Procesado
```

Esto permitiría combinar:

- representación visual;
- explicación teórica;
- percepción auditiva.

---

# 29. Posibles funciones futuras

- selección entre seno, cuadrada y triangular;
- comparación entre 44.1 y 48 kHz;
- comparación entre 16 y 24 bits;
- visualización del error de cuantización;
- visualización del ruido de cuantización;
- botón para activar/desactivar dither;
- zoom sobre las muestras;
- animación temporal;
- modo quiz;
- preguntas interactivas;
- ejercicios de Nyquist;
- reproducción A/B.

---

# 30. Principio pedagógico principal

La aplicación debe evitar presentar Sample Rate y Bit Depth simplemente como números.

El usuario debe poder **ver qué cambia cuando modifica cada parámetro**.

La explicación central será:

```text
SAMPLE RATE
¿Cuántas veces medimos?

BIT DEPTH
¿Qué tan precisa es cada medición?
```

Y visualmente:

```text
                 AMPLITUD
                    ↑
                    │
BIT DEPTH ──────────│
                    │
                    └────────────→ TIEMPO
                              SAMPLE RATE
```

Con esta estructura, la aplicación puede funcionar simultáneamente como:

- herramienta educativa;
- recurso interactivo;
- apoyo para una exposición;
- demostrador de audio digital;
- material para ejercicios en clase.
