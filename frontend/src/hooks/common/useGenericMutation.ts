import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Common';
import type { MutationFunction } from '@tanstack/react-query';

interface GenericMutationConfig<TData, TVariables> {
  mutationFn: MutationFunction<TData, TVariables>;
  invalidateQueries?: readonly unknown[][];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  onSuccessCallback?: (data: TData, variables: TVariables) => void;
  onErrorCallback?: (error: unknown, variables: TVariables) => void;
}

// Generic CRUD mutation hook
export const useGenericMutation = <TData, TVariables>({
  mutationFn,
  invalidateQueries = [],
  successMessage,
  errorMessage,
  onSuccessCallback,
  onErrorCallback,
}: GenericMutationConfig<TData, TVariables>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidate specified queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Show success message
      if (successMessage) {
        const message = typeof successMessage === 'function' 
          ? successMessage(data) 
          : successMessage;
        showSuccess(message);
      }

      // Call custom success callback
      onSuccessCallback?.(data, variables);
    },
    onError: (error, variables) => {
      console.error('Mutation failed:', error);
      
      // Show error message (if not handled globally)
      if (errorMessage) {
        showError(errorMessage);
      }

      // Call custom error callback
      onErrorCallback?.(error, variables);
    },
  });
};
