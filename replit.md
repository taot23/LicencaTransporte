# Sistema AET - Licenças de Transporte

### Overview
This project is a robust system for managing AET (Autorização Especial de Trânsito) licenses and vehicles, featuring advanced server-side performance optimizations and deployment resilience. Its main purpose is to streamline the process of issuing and managing transportation permits, ensuring compliance and operational efficiency for transport companies. Key capabilities include real-time license validation, comprehensive vehicle and transporter management, and detailed financial tracking. The business vision is to provide a reliable, scalable, and user-friendly platform that simplifies complex regulatory requirements in the logistics sector, offering significant market potential by reducing administrative burdens and improving operational flow for transport businesses.

### User Preferences
- Idioma: Português brasileiro
- Foco: Manter arquivos seguros durante reinstalações
- Prioridade: Estabilidade em produção sobre conveniência de desenvolvimento
- API calls: Usar fetch padrão ao invés de apiRequest para logout e operações simples
- Segurança: Sistema de permissões granular por tipo de usuário deve ser rigorosamente testado
- Senhas: Não alterar senhas existentes dos usuários em produção - preservar credenciais originais

### System Architecture
The system is built with a React.js frontend using TypeScript, a Node.js/Express backend, and a PostgreSQL database. Real-time communication is handled via WebSockets, and data validation uses Zod schemas. The UI/UX prioritizes responsiveness with Tailwind CSS, ensuring a consistent experience across devices.

**Recent Performance Optimization (August 2025):**
- **Ultra-fast Vehicle Search**: Plate searches optimized for 50,000+ vehicle records, responding in <1 second
- **Advanced Database Indices**: Trigram indices for partial text matching, partial indices for active vehicles only
- **Intelligent Caching**: 2-minute aggressive cache for vehicle searches, automatic invalidation on CRUD operations
- **Volume-Optimized Queries**: Trigram similarity search for short terms, traditional LIKE for longer patterns
- **Scalability Features**: Limited result sets (12-25 items), specialized indices reducing search space by 80%
- **Performance Results**: 50K+ records - First search ~150ms, cached searches ~70ms (sub-1-second guaranteed)

**Key Architectural Decisions:**
- **External Uploads System**: Files are stored in an external, configurable directory to prevent data loss during reinstalls. The system automatically detects write permissions and prioritizes `UPLOAD_DIR` (environment variable), `/var/uploads`, `/tmp/uploads`, `../uploads`, and `./uploads` in that order. Subfolders for `vehicles/` and `transporter/` ensure organization.
- **Dedicated Production Server**: A specific `server/production-server.js` is used for production deployments to avoid Vite-related issues, integrated with PM2 for process management.
- **Universal Pagination**: A standardized pagination system (`usePaginatedList`, `ListPagination`, `MobileListPagination`) is implemented across all administrative and user-facing lists (licenses, vehicles, transporters, users, invoices), ensuring performance with large datasets (e.g., 40,000+ plates).
- **Intelligent License Validation**: A robust validation system checks for existing licenses based on specific vehicle combinations (tractor + 1st trailer + 2nd trailer/dolly) across 27 Brazilian states and federal bodies (DNIT, ANTT, PRF). It blocks new requests if an identical combination has a license with more than 60 days remaining validity.
- **Real-time Updates**: WebSocket integration coupled with automatic polling (every 60 seconds) ensures that critical data (e.g., license status, dashboard statistics) is always up-to-date across the application.
- **Granular Access Control**: A detailed permission matrix defines access levels for various user roles (Operacional, Supervisor, Financeiro, Gerente, Administrador), controlling visibility of menus and access to backend endpoints.
- **Optimized Vehicle and Transporter Selectors**: Forms utilize optimized selectors with debounce, caching, and pagination for efficient searching of vehicles and transporters. Manual plate entry is also supported for dolly and second trailer fields.
- **Bulk Import System**: Allows mass import of vehicles via CSV, linking them to transporters using CNPJ/CPF from the spreadsheet. Includes robust validation and duplicate prevention.
- **Mobile Responsiveness**: The entire system is designed to be fully responsive, with a functional bottom navigation bar and optimized layouts for mobile devices across all main pages.
- **Custom Modals**: Native `confirm()` notifications are replaced with custom `AlertDialog` components for all critical confirmations, improving user experience and consistency.
- **Hierarchical Navigation**: A hierarchical sidebar menu (e.g., "Veículos" with submenus) improves navigation and organization, with dynamic expansion and access control based on user roles.

### External Dependencies
- **PostgreSQL**: Primary database for all system data.
- **Node.js/Express**: Backend framework.
- **React.js**: Frontend library.
- **TypeScript**: Programming language for both frontend and backend.
- **Zod**: Schema validation library.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **PM2**: Production process manager for Node.js applications.
- **WebSocket**: For real-time communication.
- **External API (for CNPJ/CPF lookup)**: Used for automatic data population of transporters and their branches.
- **Multer**: Middleware for handling `multipart/form-data`, used for file uploads (e.g., CSV imports, boleto/NF uploads).
- **`csv-export.ts` (internal utility)**: Standardized CSV export functionality.