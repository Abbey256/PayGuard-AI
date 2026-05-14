import PageMeta from "../../components/common/PageMeta";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign in | PayGuard AI"
        description="Sign in to PayGuard AI government payroll verification system"
      />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <SignInForm />
      </div>
    </>
  );
}
