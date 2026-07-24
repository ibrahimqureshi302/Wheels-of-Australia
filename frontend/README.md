# React 19 + TypeScript + Material-UI Project

This project was created with Vite and includes a comprehensive folder structure following modern React development best practices.

## 🚀 Technologies Used

- **React 19** - Latest React version with new features
- **TypeScript** - Type safety and better development experience
- **Material-UI (MUI)** - Modern React UI framework
- **Vite** - Fast build tool and development server
- **ESLint** - Code linting and quality assurance

## 📁 Project Structure

```
src/
├── assets/
│   ├── fonts/          # Custom fonts
│   ├── styles/         # Global styles and theme
│   │   ├── theme.ts    # Material-UI theme configuration
│   │   └── global.css  # Global CSS styles
│   └── images/         # Static images
├── components/
│   ├── Auth/           # Authentication components
│   │   └── Login/
│   │       └── Login.tsx
│   ├── Profile/        # User profile components
│   │   └── UserProfile/
│   │       └── UserProfile.tsx
│   ├── Home/           # Home page components
│   │   └── HomeView/
│   │       └── HomeView.tsx
│   ├── Dashboard/      # Dashboard components
│   │   └── DashboardView/
│   │       └── DashboardView.tsx
│   ├── Common/         # Reusable common components
│   │   ├── Button/
│   │   │   └── index.tsx  # Custom Button component
│   │   ├── Card/
│   │   │   └── index.tsx  # Custom Card component
│   │   └── index.ts       # Export barrel
│   ├── Header.tsx      # App header component
│   └── index.ts        # Export barrel
├── pages/
│   ├── home/
│   │   └── index.tsx   # Home page (imports HomeView)
│   ├── login/
│   │   └── index.tsx   # Login page (imports Login)
│   ├── profile/
│   │   └── index.tsx   # Profile page (imports UserProfile)
│   └── dashboard/
│       └── index.tsx   # Dashboard page (imports DashboardView)
├── constants/
│   └── routes.ts           # Route constants and labels
├── routes/
│   ├── components/
│   │   └── AppRoutes.tsx   # Main routing configuration
│   ├── guards/
│   │   ├── ProtectedRoute.tsx  # Auth-protected routes
│   │   └── PublicRoute.tsx     # Public-only routes
│   └── index.ts            # Export barrel
├── hooks/
│   └── index.ts        # Custom React hooks
├── services/
│   └── api.ts          # API client and services
├── store/              # State management (empty, ready for Redux/Zustand)
├── utils/
│   └── index.ts        # Utility functions
├── types/
│   └── index.ts        # TypeScript type definitions
├── context/
│   └── AuthContext.tsx # Authentication context
├── App.tsx             # Main App component
└── main.tsx            # Entry point
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🎨 Features

### Material-UI Integration
- Custom theme configuration
- Responsive design
- Dark/Light mode support (ready to implement)
- Custom styled components

### Authentication System
- Context-based auth state management
- Login/logout functionality
- Protected routes
- User profile management

### Custom Hooks
- `useLocalStorage` - Persist data in localStorage
- `useDebounce` - Debounce values
- `useAsync` - Handle async operations
- `useToggle` - Boolean state management
- `usePrevious` - Access previous values

### Utility Functions
- Date formatting
- String manipulation
- Validation helpers
- File size formatting
- Deep cloning

### API Integration
- HTTP client wrapper
- Error handling
- Request/response interceptors
- Pagination support

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## 📝 Development Guidelines

### Component Structure
- Use functional components with TypeScript
- Implement proper prop types
- Follow Material-UI design patterns
- Keep components small and focused

### State Management
- Use React Context for global state
- Custom hooks for component logic
- Consider Redux Toolkit for complex state

### Styling
- Use Material-UI's `sx` prop for styling
- Maintain consistent design tokens
- Responsive design first

### File Organization
- Group related files in feature folders
- Use index files for clean imports
- Separate concerns (UI, logic, data)

## 🔧 Customization

### Theme
Edit `src/assets/styles/theme.ts` to customize:
- Colors
- Typography
- Spacing
- Component overrides

### API Configuration
Update `src/services/api.ts` for:
- Base URL configuration
- Authentication headers
- Request/response interceptors

### Authentication
Modify `src/context/AuthContext.tsx` to integrate with your backend authentication system.

## 📦 Adding New Components

**For Feature Components:**
1. Create main folder: `src/components/NewFeature/`
2. Create component folder: `src/components/NewFeature/ComponentName/`
3. Add component file: `src/components/NewFeature/ComponentName/ComponentName.tsx`
4. Create page: `src/pages/new-page/index.tsx` that imports the component
5. Update App.tsx: Add the new page to routing

**For Common/Reusable Components:**
1. Create component folder: `src/components/Common/ComponentName/`
2. Add component file: `src/components/Common/ComponentName/index.tsx`
3. Export in Common index: Add export to `src/components/Common/index.ts`
4. Import anywhere: `import ComponentName from '../Common/ComponentName'`

## Deploy on Vercel

### Deploy from the terminal (no GitHub required)

You can deploy using only the Vercel CLI; no Git repo or GitHub connection is required.

1. **From the `frontend` folder**, log in (one time; opens browser):
   ```bash
   cd frontend
   npx vercel login
   ```
2. **If you see “must have access to the team …”**  
   The project is linked to a Vercel **team** your account can’t deploy to. Deploy to your **personal** account instead:
   ```bash
   cd frontend
   rm -rf .vercel
   npx vercel switch
   ```
   When prompted, select your **personal** account (your username), not a team. Then:
   ```bash
   npx vercel
   ```
   When asked “Set up and deploy?”, choose **Y**. For “In which scope do you want to deploy?”, pick your **personal** account again. Create a new project (or link to an existing one under your user). Root directory is `./` (you’re already in `frontend`).
3. **Deploy** (preview):
   ```bash
   npm run deploy
   ```
   Or deploy to **production**:
   ```bash
   npm run deploy:prod
   ```
   No global install needed—`npx vercel` runs the CLI. After the first link, subsequent deploys use the saved project.

### Deploy from the Vercel dashboard

1. Push the repo to GitHub/GitLab/Bitbucket (if not already).
2. Go to [vercel.com](https://vercel.com), sign in, and click **Add New Project**.
3. Import your repository. Set **Root Directory** to `frontend`.
4. Add any environment variables under **Settings → Environment Variables** (e.g. `VITE_API_URL`).
5. Click **Deploy**. The app uses `vercel.json` (build, output `dist`, SPA rewrites).

## 🤝 Contributing

1. Follow the established folder structure
2. Use TypeScript for all new files
3. Follow Material-UI design patterns
4. Write meaningful commit messages
5. Test your changes

---

Built with ❤️ using React 19, TypeScript, and Material-UI