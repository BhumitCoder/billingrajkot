# Ibell - Invoice Management System

## Overview

A GST billing and invoice management system built with React, TypeScript, and Vite. Features include billing, inventory management, client management, expense tracking, and AI-powered features via OpenAI integration. Uses Firebase for backend services.

## Recent Changes

- 2026-02-11: Initial import to Replit environment completed. Dependencies installed, workflow configured.

## Project Architecture

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS with shadcn/ui components
- **Backend**: Firebase (authentication, Firestore, storage)
- **AI**: OpenAI integration for AI agent features
- **PWA**: Service worker via vite-plugin-pwa
- **Routing**: React Router v6

### Directory Structure

- `src/pages/` - Page components (Dashboard, Bills, Products, Clients, etc.)
- `src/components/` - Reusable components including shadcn/ui
- `src/lib/` - Utility functions (Firebase service, billing utils, AI extraction)
- `src/hooks/` - Custom React hooks
- `src/contexts/` - React context providers
- `src/types/` - TypeScript type definitions

### Key Configuration

- Dev server: `0.0.0.0:5000` with `allowedHosts: true`
- Path alias: `@` maps to `./src`

## User Preferences

- (None recorded yet)
