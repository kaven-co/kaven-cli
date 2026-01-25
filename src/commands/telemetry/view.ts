import chalk from "chalk";
import { TelemetryBuffer } from "../../infrastructure/TelemetryBuffer";

export async function telemetryView(limit: number = 10): Promise<void> {
  const telemetry = TelemetryBuffer.getInstance();
  const events = await telemetry.getRecentEvents(limit);

  if (events.length === 0) {
    console.log(chalk.yellow("\nNenhum evento de telemetria encontrado localmente.\n"));
    return;
  }

  console.log(chalk.blue.bold(`\n📊 Últimos ${events.length} eventos de telemetria:\n`));

  events.forEach((e) => {
    const time = chalk.gray(`[${new Date(e.timestamp).toLocaleTimeString()}]`);
    const status = e.event.includes("error") ? chalk.red("✖") : chalk.green("✔");
    const duration = e.duration ? chalk.yellow(` (${e.duration}ms)`) : "";
    
    console.log(`${time} ${status} ${chalk.cyan(e.event)}${duration}`);
    
    if (e.metadata && Object.keys(e.metadata).length > 0) {
      console.log(chalk.gray(`   > ${JSON.stringify(e.metadata)}`));
    }
  });

  console.log(chalk.gray("\nLog local: ~/.kaven/telemetry.log\n"));
}
