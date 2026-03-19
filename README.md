# 📊 ORACLE - Monitor de Proyectos Docker

**ORACLE** es una plataforma de monitoreo centralizada diseñada para supervisar el rendimiento y la salud de múltiples proyectos desplegados en contenedores Docker a través de servidores remotos. 

Olvídate de entrar por terminal a cada servidor para ver cómo están tus apps. Con ORACLE, puedes tener una visión global y profesional de todos tus despliegues en un solo panel de control.

## 🚀 ¿Qué ofrece ORACLE?

El sistema proporciona métricas en tiempo real y gráficos históricos detallados para cada contenedor de tus proyectos:

*   **📈 Uso de CPU**: Monitoriza el porcentaje de procesamiento consumido.
*   **🧠 Memoria RAM**: Visualiza el consumo actual frente al límite configurado, con alertas de saturación.
*   **💾 I/O de Disco**: Seguimiento de las velocidades de lectura y escritura.
*   **🌐 Tráfico de Red**: Gráficos de carga (TX) y descarga (RX) de datos.
*   **🔄 Estado de Salud**: Conteo de reinicios automáticos de contenedores y número de procesos activos (PIDs).
*   **🔔 Alertas Inteligentes**: Sistema integrado con **Twilio** para enviar notificaciones automáticas por **WhatsApp** si la instancia de un proyecto se queda sin recursos.

## 🛠️ ¿Cómo obtiene los datos?

ORACLE utiliza una estrategia **sin agentes (agentless)**. Esto significa que no necesitas instalar nada en tus servidores remotos de producción. 

1.  El sistema se conecta vía **SSH** (usando llaves privadas) a tus servidores.
2.  Ejecuta comandos nativos como `docker stats` para extraer métricas precisas directamente del motor de Docker.
3.  Los datos se almacenan en una base de datos de alto rendimiento (**InfluxDB**) y se presentan en un dashboard moderno e interactivo.

---

## 💻 Guía de Instalación

Sigue estos pasos para levantar ORACLE en tu máquina local o en tu propio servidor de monitoreo.

### Requisitos Previos

Solo necesitas tener instalado:
*   [Docker](https://www.docker.com/products/docker-desktop/)
*   Docker Compose (normalmente incluido con Docker Desktop)

### Paso 1: Clonar el Repositorio

Abre una terminal y clona el proyecto:
```bash
git clone https://github.com/tu-usuario/monitoreo-de-proyectos.git
cd monitoreo-de-proyectos
```

### Paso 2: Iniciar el Sistema

ORACLE está totalmente automatizado. No necesitas configurar bases de datos manualmente. Ejecuta el siguiente comando para construir e iniciar todos los servicios:

```bash
docker compose up --build -d
```

Este comando creará cuatro contenedores:
1.  **Frontend**: La interfaz web (React).
2.  **Backend**: El cerebro del sistema (NestJS).
3.  **Postgres**: Almacena la configuración de tus proyectos y contactos.
4.  **InfluxDB**: Almacena las métricas de rendimiento.

### Paso 3: Acceder al Panel

Una vez que Docker termine de levantar los servicios, abre tu navegador y entra en:

👉 **[http://localhost:3000](http://localhost:3000)**

### Paso 4: Configuración Inicial

1.  Ve a la sección de **Configuración**.
2.  Verás que los campos de InfluxDB ya están configurados automáticamente para ti.
3.  (Opcional) Configura tus credenciales de **Twilio** si deseas recibir alertas por WhatsApp.
4.  ¡Listo! Ya puedes ir a la sección de **Proyectos** y añadir tu primer servidor usando su IP, usuario y llave SSH.

---

## 🔒 Seguridad
El sistema utiliza comunicación interna segura dentro de la red de Docker. Para el acceso remoto a tus servidores, se recomienda usar llaves SSH protegidas y no contraseñas planas.

## 📄 Licencia
Este proyecto es de código abierto. ¡Siéntete libre de contribuir o adaptarlo a tus necesidades!
