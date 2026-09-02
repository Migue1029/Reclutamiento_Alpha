#### ReclutamientoAlpha 

Sistema web integral de gestión de empleados, migración de datos y generación automatizada de documentos oficiales desarrollado para Alpha Cerámica S.A.P.I. de C.V..  

El sistema moderniza y centraliza el proceso administrativo de Reclutamiento y Recursos Humanos, reemplazando un modelo basado en hojas de cálculo dispersas e impresos por una plataforma relacional, rápida e intuitiva.  



### 📌 Tabla de Contenidos

Características Principales

Arquitectura del Sistema

Stack Tecnológico

Estructura del Proyecto

Modelo de Base de Datos

Instalación y Configuración

Uso del Sistema

Autores y Créditos



##### Características Principales

* Gestión Centralizada (CRUD): Alta, lectura, edición y baja de empleados dentro de una interfaz unificada.  
* Formulario Único con Validaciones: Captura completa de datos personales, laborales y beneficiarios con validación en tiempo real y normalización (CURP, RFC, NSS, direcciones, edad).  
* Buscador y Filtros Avanzados: Búsqueda en tiempo real por nombre, CURP, RFC, número de trabajador, puesto, área, tipo de nómina o municipio.  
* Generación Automática de Documentos: Creación de documentos oficiales en Word (.docx) mediante plantillas dinámicas:
1. Contratos (Sindicalizado/Empleado, Determinado/Indeterminado)  
2. Credenciales  
3. Carátula de Expediente / Check List  
4. Etiquetas y Evaluaciones de Personal  
* Eliminación de Duplicados: Filtros de backend y procedimientos que previenen la duplicidad e inconsistencia de registros
* Modo Aplicación Escritorio: Soporte para ejecutar la plataforma a través de Electron.js o scripts de inicio rápido (.bat, .vbs, .cmd)



##### Arquitectura del Sistema

El sistema implementa una arquitectura Cliente-Servidor (REST API) con comunicación asíncrona mediante JSON:  

&#x20;                                         HTTP/REST API

Usuario <-----> Sistema web (Frontend) <-----------------> Servirdor (Node.js + Express)



##### Stack Tecnológico

Frontend

* HTML5 \& CSS3: Estructura modular, estilos personalizados y paleta de colores institucional.
* JavaScript (ES6+): Lógica interactiva, peticiones asíncronas (fetch API), normalizadores y filtros de búsqueda.

BackendNode.js \& Express.

* js: Servidor HTTP, enrutamiento, validaciones avanzadas y API REST.  
* Docxtemplater \& Pizzip: Procesamiento de plantillas .docx para la generación automática de contratos y documentos.  



Base de Datos \& Ejecución

* Microsoft SQL Server: Almacenamiento relacional con integridad referencial, tablas normalizadas y vistas consolidadas (vw\_EmpleadosFull).
* Electron.js: Embebido y empaquetado como aplicación de escritorio ejecutable.



##### Estructura del Proyecto:

reclutamientoAlpha/

├── backend/

│   ├── db/

│   │   └── 001\_vw\_EmpleadosFull.sql     # Script de creación de vistas en SQL Server

│   ├── templates/                        # Plantillas Word (.docx) para contratos y checklists

│   ├── node\_modules/

│   ├── package.json

│   └── server.js                         # Servidor Express, rutas API y lógica de negocio

└── frontend/

&#x20;   ├── css/

&#x20;   │   ├── filtros-ml.css

&#x20;   │   ├── gestion.css

&#x20;   │   └── styles.css                    # Hoja de estilos principal

&#x20;   ├── imagenes/                         # Recursos gráficos y logotipos institucionales

&#x20;   ├── js/

&#x20;   │   ├── api.js                        # Cliente de comunicación HTTP (Fetch)

&#x20;   │   ├── app.js                        # Inicialización del frontend

&#x20;   │   ├── fill-form.js                  # Autocompletado dinámico de campos

&#x20;   │   ├── form-empleado.js              # Captura y validación de formulario

&#x20;   │   ├── generador-oficial.js          # Disparador de generación de documentos

&#x20;   │   ├── gestion.js                    # Control de la tabla interactiva de empleados

&#x20;   │   ├── gestion-filtros.js            # Lógica de modal y filtros dinámicos

&#x20;   │   ├── normalizers.js                # Limpieza y homologación de cadenas

&#x20;   │   └── search-box.js                 # Buscador en tiempo real

&#x20;   ├── gestion.html                      # Panel de administración e inventario de empleados

&#x20;   └── index.html                        # Registro principal y generación de documentos



\---



##### Modelo de Base de Datos



El diseño relacional elimina las inconsistencias originadas en las hojas de Excel mediante tablas normalizadas e integridad referencial:



\* \*\*Tablas Principales:\*\* `Empleado`, `Area`, `Puesto`, `TipoNomina`, `JefeInmediato`, `Contrato`, `Beneficiario`, `Evaluacion` y `Salario`.

\* \*\*Vista Principal (`vw\_EmpleadosFull`):\*\* Unifica los datos laborales, personales, salariales y de beneficiarios para simplificar las consultas del Backend y del Frontend.

\* \*\*Entorno Staging (`stg.Raw\_Empleados`):\*\* Zona temporal utilizada durante la fase de migración y depuración masiva de datos.



\---



##### Instalación y Configuración



\### Pre-requisitos

\* \*\*Node.js\*\* (v16.x o superior)

\* \*\*Microsoft SQL Server\*\* (2019 o superior) con SQL Server Management Studio (SSMS)



\### 1. Configuración de la Base de Datos

1\. Abra SQL Server Management Studio (SSMS).

2\. Ejecute el script de creación del esquema de la base de datos `ReclutamientoAlpha`.

3\. Ejecute el archivo ubicado en `backend/db/001\_vw\_EmpleadosFull.sql` para habilitar la vista unificada.



\### 2. Configuración del Backend

1\. Navegue al directorio del backend:

&#x20;  

&#x20;  cd backend



Instale las dependencias necesarias:



npm install



Configure las variables de entorno o ajuste el archivo de conexión server.js / .env con las credenciales de su SQL Server:



Fragmento de código

DB\_HOST=localhost

DB\_PORT=1433

DB\_NAME=ReclutamientoAlpha

DB\_USER=sa

DB\_PASSWORD=tu\_contraseña

PORT=3001



3\. Ejecución del Sistema

Inicie el servidor Backend:



npm run start

\# o node server.js





Acceda desde el navegador a: `http://localhost:3001`\[cite: 2] (o abra el archivo `frontend/index.html` según la configuración de entrega local)\[cite: 1]. También puede iniciar la aplicación mediante los scripts ejecutables (`Start ReclutamientoAlpha.bat`)



\---



##### Uso del Sistema



1\. \*\*Registro de Empleado:\*\* Complete los datos en el formulario principal (`index.html`). Los campos de edad, normalización de dirección y estado civil se procesan automáticamente

2\. \*\*Generación de Documentos:\*\* En el menú lateral, seleccione el tipo de contrato, credencial o checklist. El sistema completará la plantilla `.docx` con los datos del empleado activo

3\. \*\*Gestión de Empleados:\*\* Ingrese a `gestion.html` para visualizar el catálogo, aplicar filtros avanzados por municipio, puesto o nómina, editar datos o dar de baja registros



\---



##### Autores y Créditos



Proyecto desarrollado como \*\*Estadía Profesional\*\* para la carrera de \*\*Ingeniería en Sistemas Computacionales\*\* en la \*\*Universidad Politécnica de Tlaxcala Región Poniente (UPTrep)\*\* para la empresa \*\*Alpha Cerámica S.A.P.I. de C.V.\*\*:



\* \*\*Desarrollo Frontend \& UI/UX:\*\* Hugo Sanchez Flores (Matrícula: 22SIC013)

\* \*\*Desarrollo Backend \& Base de Datos:\*\* Miguel Angel Sanchez Larios (Matrícula: 22SIC006)

\* \*\*Asesora Interna:\*\* Ing. Miriam López Sanluis

\* \*\*Asesora Externa:\*\* Lic. Mónica Vilchis Morales











