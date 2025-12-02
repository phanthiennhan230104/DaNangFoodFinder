import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as favService from '../services/favorites';

const FAV_KEY = ['favorites'];

export function useFavorites() {
  const qc = useQueryClient();

  const query = useQuery(FAV_KEY, favService.fetchFavorites, {
    staleTime: 1000 * 60 * 2, // 2 minutes
    cacheTime: 1000 * 60 * 10,
    retry: 1,
  });

  const addMutation = useMutation(favService.addFavorite, {
    // optimistic update
    onMutate: async (restaurantId) => {
      await qc.cancelQueries(FAV_KEY);
      const prev = qc.getQueryData(FAV_KEY) || [];
      // add temporary favorite item
      const fake = { id: `temp-${restaurantId}`, restaurant: { id: restaurantId } };
      qc.setQueryData(FAV_KEY, (old = []) => [...old, fake]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(FAV_KEY, context.prev);
    },
    onSettled: () => qc.invalidateQueries(FAV_KEY),
  });

  const removeMutation = useMutation(favService.deleteFavorite, {
    onMutate: async (restaurantId) => {
      await qc.cancelQueries(FAV_KEY);
      const prev = qc.getQueryData(FAV_KEY) || [];
      qc.setQueryData(FAV_KEY, (old = []) => old.filter((f) => f.restaurant?.id !== restaurantId));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(FAV_KEY, context.prev);
    },
    onSettled: () => qc.invalidateQueries(FAV_KEY),
  });

  return {
    favoritesQuery: query,
    addFavorite: addMutation.mutateAsync,
    removeFavorite: removeMutation.mutateAsync,
  };
}

export default useFavorites;
