# Dédale

[![Rust](https://img.shields.io/badge/Backend-Rust-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/Frontend-React-blue?logo=react)](https://react.dev/)
[![React Native](https://img.shields.io/badge/Mobile-React_Native-61DAFB?logo=react)](https://reactnative.dev/)

## Project overview

**Dédale** is an application developed for the **Eurométropole de Strasbourg**, intended for the **management and organization of sporting events and public events** (races, urban events, etc.).

The application makes it possible to plan events, organize the equipment to be installed, manage watch zones and coordinate the staff and teams involved in setting up and removing the equipment.

The project consists of a **desktop application** intended for planning and supervision, as well as a **mobile application** intended for the field and agents.

## Goals

- Centralize the management of public events  
- Organize equipment, zones and routes  
- Manage staff, teams and their schedules  
- Facilitate coordination between the field and supervision  
- Provide a cartographic and temporal visualization of events  

## Technologies used

### Desktop application

- Tauri (Rust) 
- React (TypeScript)

### Mobile application  

- Expo Go (React Native)

### Database

- SQLite (.db)

## Repository structure

```
Frontend/
├── Web/
│   └── Dedale/        # Desktop application (Tauri + React)
├── Mobile/
│   └── Dedale/        # Mobile application (React Native)
└── start-dedale.sh          # Global launch script
```

## Installation and launch

### Prerequisites

- Node.js

- Rust

- SQLite

- Expo Go (mobile or emulator)

### Global launch of the project

A shell script makes it possible to launch all the dependencies required by the project (desktop application and mobile application).


### Desktop application

The desktop application code is located in: Frontend/Web/Dedale

The desktop application is developed with Tauri, combining a Rust backend and a React interface. It is used for planning, supervision and the overall management of events.

### Mobile application

The mobile application code is located in: Frontend/Mobile/Dedale

### Main features

- Event management

- Staff management

- Team management

- Schedule management

- Interactive map with management of equipment, watch zones, routes and points of interest, and live timeline visualization

- Data transfer via QR Code between the mobile application and the desktop application

### Team

Project carried out as part of a group work (team dedale/CRS/Krisprolls/ex-CRS/extreme-inateur) for an institutional client: Eurométropole de Strasbourg
