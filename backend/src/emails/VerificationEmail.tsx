import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface VerificationEmailProps {
  verificationLink: string;
  userName?: string;
}

export function VerificationEmail({
  verificationLink,
  userName = "there",
}: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your TapaRide account</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logo}>TapaRide</Text>
          </Section>
          <Heading style={heading}>Welcome to TapaRide!</Heading>
          <Text style={text}>Hi {userName},</Text>
          <Text style={text}>
            Thank you for creating your TapaRide account. We're excited to have
            you on board. Click the button below to verify your email address
            and get started.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={verificationLink}>
              Verify Email Address
            </Button>
          </Section>
          <Text style={text}>
            This link expires in 24 hours. If you didn't create this account,
            you can safely ignore this email.
          </Text>
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2026 TapaRide Rwanda · Made in Kigali
            </Text>
            <Text style={footerText}>
              Need help? Contact us at nielneza@outlook.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f5f4ff",
  fontFamily:
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "480px",
};

const logoSection = {
  textAlign: "center" as const,
  marginBottom: "32px",
};

const logo = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#10075c",
};

const heading = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#1d1d1f",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const text = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#424245",
  margin: "0 0 16px",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#0071e3",
  borderRadius: "980px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
  display: "inline-block",
};

const footerSection = {
  marginTop: "40px",
  paddingTop: "24px",
  borderTop: "1px solid #e5e5e7",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#86868b",
  margin: "4px 0",
};

export default VerificationEmail;
