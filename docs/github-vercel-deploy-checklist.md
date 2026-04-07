# GitHub -> Vercel Deployment Checklist (blog-gedeon)

Use this every time you deploy.

## Where to run each step

1. Local terminal (PowerShell): code changes, tests, git.
2. GitHub website: pull request and merge.
3. Vercel dashboard: deployment status and logs.

## 1) Local terminal - prepare and verify

Open PowerShell and run:

```powershell
cd "C:\Users\MateuszDudek\Documents\AI APP\blog-gedeon"
git checkout main
git pull origin main
git checkout -b feat/short-change-name
```

Make code changes, then run checks:

```powershell
npm run lint
npm run build
```

Review and commit:

```powershell
git status
git diff
git add .
git commit -m "feat: short change summary"
git push -u origin feat/short-change-name
```

## 2) GitHub - create and merge PR

1. Open repository on GitHub.
2. Click `Compare & pull request`.
3. Set base to `main`, compare to your branch.
4. Add PR title and short description:
   - what changed
   - why
   - checks passed (`npm run lint`, `npm run build`)
5. Click `Create pull request`.
6. After checks are green, click `Merge pull request`.

## 3) Vercel - confirm production deployment

1. Open project in Vercel.
2. Go to `Deployments`.
3. Confirm latest deployment from `main` is `Ready`.
4. If failed, open logs and fix, then repeat from step 1.

## 4) Production smoke test

Check on live domain:

1. Homepage loads.
2. Blog list and single article load.
3. Admin login page loads.
4. Theme toggle works and persists after refresh.
5. Favicon and logo are correct.
6. No obvious 4xx/5xx errors in Vercel logs.

## 5) Optional hotfix flow (fast)

If fix is urgent:

```powershell
git checkout main
git pull origin main
git checkout -b fix/hotfix-name
# make fix
npm run lint
npm run build
git add .
git commit -m "fix: hotfix summary"
git push -u origin fix/hotfix-name
```

Then create and merge PR as usual.
