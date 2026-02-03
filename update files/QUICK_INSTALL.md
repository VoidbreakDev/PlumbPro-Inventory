# PlumbPro Inventory - Quick Install

## One-Command Installation

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/PlumbPro-Inventory/main/install.sh | bash
```

Or download and run:
```bash
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell as Administrator)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; .\install.ps1
```

---

## What Gets Installed

✅ **Node.js v20** (if not present)
✅ **PostgreSQL 15** (if not present)
✅ **PlumbPro Database** (auto-configured)
✅ **All Dependencies** (server & client)
✅ **System Service** (auto-start on boot)
✅ **Desktop Shortcuts**
✅ **CLI Management Tool**
✅ **Admin Account** (you create during install)

---

## Installation Time

⏱️ **First Install**: 10-15 minutes (includes downloading dependencies)
⏱️ **With Dependencies**: 3-5 minutes
📦 **Total Size**: ~500MB

---

## After Installation

### Start Application
```bash
./plumbpro.sh start  # macOS/Linux
.\plumbpro.ps1 start  # Windows
```

### Access Application
Open browser: **http://localhost:3000**

### Login
Use the email and password you created during installation.

---

## Quick Commands

| Action | macOS/Linux | Windows |
|--------|-------------|---------|
| Start | `./plumbpro.sh start` | `.\plumbpro.ps1 start` |
| Stop | `./plumbpro.sh stop` | `.\plumbpro.ps1 stop` |
| Status | `./plumbpro.sh status` | `.\plumbpro.ps1 status` |
| Logs | `./plumbpro.sh logs` | `.\plumbpro.ps1 logs` |
| Backup | `./plumbpro.sh backup` | `.\plumbpro.ps1 backup` |

---

## What to Do First

1. ✅ **Complete Installation** - Run installer script
2. ✅ **Start Application** - Use start command
3. ✅ **Login** - Access http://localhost:3000
4. ⚙️ **Configure Email** (optional) - See INSTALLATION_GUIDE.md
5. 🤖 **Setup AI** (optional) - See AI_PROVIDER_SETUP.md
6. 📦 **Import Data** - Add your inventory items
7. 🔄 **Create Workflows** - Use templates to automate tasks

---

## Troubleshooting

### Can't Access Application?
```bash
# Check if server is running
./plumbpro.sh status

# Check logs for errors
./plumbpro.sh logs
```

### Installation Failed?
Check installation log:
- **macOS/Linux**: `~/.plumbpro/install.log`
- **Windows**: `%APPDATA%\PlumbPro\install.log`

### Need Help?
See **INSTALLATION_GUIDE.md** for detailed troubleshooting.

---

## Uninstall

```bash
./uninstall.sh  # macOS/Linux
.\uninstall.ps1  # Windows
```

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | Win 10, macOS 11, Ubuntu 20.04 | Win 11, macOS 13, Ubuntu 22.04 |
| **RAM** | 2GB | 4GB+ |
| **Storage** | 500MB | 2GB |
| **Node.js** | v18 | v20 |
| **PostgreSQL** | 12 | 15 |

---

## Features After Install

### ✅ Immediately Available
- Inventory Management
- Job Tracking
- Contact Management
- Stock Movements
- Reporting & Analytics
- User Authentication
- Notifications

### ⚙️ Requires Configuration
- Email Notifications (SMTP setup)
- AI Features (API keys)
- Mobile PWA (install from browser)
- Workflow Automation (create workflows)

---

## Getting Started Resources

📚 **Documentation:**
- `INSTALLATION_GUIDE.md` - Complete installation instructions
- `SETUP.md` - Initial setup and configuration
- `WORKFLOW_AUTOMATION.md` - Automate your business processes
- `MOBILE_FEATURES.md` - Mobile field service guide
- `AI_PROVIDER_SETUP.md` - AI configuration

🎬 **Quick Tutorials:**
1. Add your first inventory item
2. Create a job
3. Set up a workflow from template
4. Configure low stock alerts
5. Install mobile PWA

---

## Support

Need help? Check these resources:
1. **Documentation** - Read the guides above
2. **Logs** - Check `~/.plumbpro/server.log`
3. **Database** - Test connection: `psql $DATABASE_URL`
4. **GitHub Issues** - Report bugs or request features

---

**Ready to get started? Run the installer!** 🚀
