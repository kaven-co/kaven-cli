import chalk from "chalk";
import { AuthService } from "../../core/AuthService";

export async function authLogout(): Promise<void> {
  const authService = new AuthService();

  try {
    if (!(await authService.isAuthenticated())) {
      console.log(chalk.yellow("You are not authenticated."));
      return;
    }

    await authService.logout();
    console.log(chalk.green("Logged out successfully."));
  } catch {
    console.error(chalk.red("Error during logout."));
    process.exit(1);
  }
}
