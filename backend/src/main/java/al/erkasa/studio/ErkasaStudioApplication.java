package al.erkasa.studio;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Erkasa Animation Studio backend: projects, production orchestration, asset registry and AI workers.
 * Each top-level package under {@code al.erkasa.studio} is a module with its own boundary.
 */
@SpringBootApplication
public class ErkasaStudioApplication {

    public static void main(String[] args) {
        SpringApplication.run(ErkasaStudioApplication.class, args);
    }
}
