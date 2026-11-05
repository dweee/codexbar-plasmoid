{
  description = "CodexBar Plasma widget (dweee fork with macOS CodexBar parity)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAll (pkgs: {
        default = pkgs.stdenvNoCC.mkDerivation {
          pname = "codexbar-plasmoid";
          version = (builtins.fromJSON (builtins.readFile ./metadata.json)).KPlugin.Version;
          src = self;
          dontBuild = true;
          # The node suites cover the catalog, providers, notifications and
          # the macOS parity reducers ported from upstream CodexBar's tests.
          doCheck = true;
          nativeCheckInputs = [ pkgs.nodejs ];
          checkPhase = ''
            runHook preCheck
            for t in tests/test-*.js; do
              node "$t"
            done
            runHook postCheck
          '';
          installPhase = ''
            runHook preInstall
            dest=$out/share/plasma/plasmoids/com.github.psimaker.codexbar
            mkdir -p $dest
            cp -a metadata.json contents $dest/
            runHook postInstall
          '';
          meta = {
            description = "KDE Plasma 6 panel widget for CodexBar usage limits, with macOS CodexBar parity";
            homepage = "https://github.com/dweee/codexbar-plasmoid";
            license = nixpkgs.lib.licenses.mit;
            platforms = nixpkgs.lib.platforms.linux;
          };
        };
      });

      checks = forAll (pkgs: {
        plasmoid = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      });

      formatter = forAll (pkgs: pkgs.nixfmt);
    };
}
