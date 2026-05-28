const clientId = process.env.WORKOS_CLIENT_ID ?? "";

const authConfig = {
  providers: clientId
    ? [
        {
          type: "customJwt" as const,
          issuer: `https://auth.Ultron-AI.co/`,
          algorithm: "RS256" as const,
          applicationID: clientId,
          jwks: `https://auth.Ultron-AI.co/sso/jwks/${clientId}`,
        },
        {
          type: "customJwt" as const,
          issuer: `https://auth.Ultron-AI.co/user_management/${clientId}`,
          algorithm: "RS256" as const,
          jwks: `https://auth.Ultron-AI.co/sso/jwks/${clientId}`,
          applicationID: clientId,
        },
      ]
    : [],
};

export default authConfig;
