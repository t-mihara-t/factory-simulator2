# Reuse record

Source repository: `t-mihara-t/factory-simulator`.
Confirmed GitHub main revision: `8348716f52e4fea4093580e997112c5e5fe1df5b`.
The owner requested code reuse in `factory-simulator2`. No additional third-party license grant is made by this repository.

| File | Source Git blob SHA | Treatment |
|---|---|---|
| dist/catalog.js | 1948815b6ec75d232102b495c4689a4adc5f65e3 | Unchanged; game-specific conversions are in simulation.js |
| dist/audio.js | 2ef91d090be1ae304f09a464f28a6ac6b0813b43 | Unchanged |
| dist/music.js | c2de0b5aa2429a51c9c843487e269f943332f6f1 | Unchanged |
| dist/assets/trains-v08.png | 05d987626f9f4eff837cc1616d871e9638f03581 | Unchanged atlas used directly in Canvas and UI |
| dist/assets/worker-v08.png | 326cc082217835cbd093bb9be5c309f0f88d9c08 | Unchanged |
| dist/assets/sunny-assembly.wav | fc35c476170fe95bd9befc56325b1fc0f64fba25 | Unchanged original music fallback |
| dist/assets/icon.svg | 51a10973193903cc8ade893230d77cd896d4c4b6 | Unchanged |

The three JavaScript files were read at the pinned revision using the GitHub connection. The four local asset hashes match the remote tree at that revision.

New: simulation.js, world.js, app.js, index.html, style.css, proposal.html, tests, documentation and the six-building atlas `factory-buildings.png`.
The building atlas is an original generated image, supplied as 1536 × 1024 RGBA, six cells in a 3 × 2 grid. It is used directly without modifying its pixels.

The old simulation engine, UI, save data, scenario IDs, native identifiers, Git metadata and hosting identity are not copied. The older local checkout remains untouched.
