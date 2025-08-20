{pkgs}: {
  deps = [
    pkgs.openssh
    pkgs.git
    pkgs.postgresql
    pkgs.jq
  ];
}
